import { Router } from "express";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import dns from "node:dns/promises";
import net from "node:net";
import { verifyProxySignature, sign as signProxyTarget, PROXY_SIGNATURE_TTL_MS } from "../anivexa/core/proxy-sign.js";

const router = Router();
const PLAYLIST_REWRITE_TTL_MS = PROXY_SIGNATURE_TTL_MS;

function signForRewrite(target: string, referer: string | null | undefined, exp: number): string {
  return signProxyTarget(target, referer, exp);
}

// ─────────────────────────────────────────────────────────────────────────────
// HLS/media proxy — some Anivexa providers (AniKoto's Megaplay/VidWish
// backend, AnimeGG) refuse to serve their .m3u8/.mp4 unless the request
// carries a specific Referer header. Browsers don't allow JS to set that
// header (it's a forbidden header name for fetch/XHR/<video>), so it has to
// go through this server-side proxy instead.
//
// For m3u8 playlists we also rewrite every referenced URI (variant streams,
// segments, subtitle/audio group URIs, AES keys) to loop back through this
// same proxy with the same referer — otherwise only the master manifest
// would carry the right header and every segment fetch would still 403.
//
// SECURITY: this endpoint fetches an arbitrary user-supplied URL server-side,
// which is a classic SSRF/open-proxy shape. It is locked down two ways:
//   1. Hostname allowlist — only known Anivexa provider CDN domains (the
//      ones our own listServers() output ever points at) may be targeted.
//      Add a domain here only when a real provider needs it.
//   2. Resolved-IP check — even an allowlisted hostname is rejected if DNS
//      resolves it to a private/loopback/link-local address, to block DNS
//      rebinding against internal services.
// Requests are also capped with an upstream timeout and a response size
// limit so this can't be used to tie up the server or exfiltrate large
// amounts of data.
// ─────────────────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 200 * 1024 * 1024; // 200MB — generous for a single HLS segment/short mp4

// Known CDN domains actually used by listServers() for "direct" entries.
// Match is by suffix (so subdomains are allowed) — add new provider CDN
// domains here as they're introduced, never widen this to "allow anything".
const ALLOWED_HOST_SUFFIXES = [
  "mewstream.buzz",
  "watching.onl",
  "megaplay.buzz",
  "vidwish.live",
  "vid-cdn.xyz",
  "anidb.app",
  "vivibebe.site",
  "animegg.org",
  "vidcache.net",
  "neongambit.com",
  "workers.dev", // anicloud-hls-proxy.*.workers.dev (2DHive's hiAnime option)
  "cdn-centaurus.com", // AniNeko's StreamHG mirror
  "acek-cdn.com", // AniNeko's Earnvids mirror
  "silverpeakenterprises.online", // AniNeko StreamHG's alt (.txt/hls3) CDN
];

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b! >= 16 && b! <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a === 100 && b! >= 64 && b! <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fec0:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
    if (lower.startsWith("::ffff:")) return isPrivateOrReservedIp(lower.slice(7));
    return false;
  }
  return true; // unrecognized shape — refuse rather than risk it
}

async function assertSafeTarget(target: URL, signed: boolean): Promise<void> {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  // A validly-signed request means OUR OWN server already resolved this
  // exact URL from a provider and minted the link — trust it regardless of
  // hostname. Providers' mirrors rotate through effectively unlimited
  // randomly-generated CDN hostnames (see proxy-sign.js), so a fixed
  // allowlist can't keep up; unsigned requests still fall back to it.
  if (!signed && !isAllowedHost(target.hostname)) {
    throw new Error(`Host not allowed: ${target.hostname}`);
  }
  // Guard against DNS rebinding: resolve the hostname and reject if it
  // points at a private/loopback/link-local address. Applied unconditionally
  // — a valid signature proves provenance, not that the resolved IP is safe.
  if (net.isIP(target.hostname)) {
    if (isPrivateOrReservedIp(target.hostname)) throw new Error("Target IP not allowed");
    return;
  }
  const records = await dns.lookup(target.hostname, { all: true });
  if (records.length === 0) throw new Error("Could not resolve host");
  for (const r of records) {
    if (isPrivateOrReservedIp(r.address)) throw new Error("Target resolves to a disallowed IP");
  }
}

function isM3U8(url: string, contentType: string): boolean {
  return (
    /\.m3u8(\?|$)/i.test(url) ||
    contentType.includes("mpegurl") ||
    contentType.includes("vnd.apple.mpegurl")
  );
}

function buildProxyUrl(req: Request, target: string, referer?: string | null): string {
  const exp = Date.now() + PLAYLIST_REWRITE_TTL_MS;
  const sig = signForRewrite(target, referer, exp);
  const qs = new URLSearchParams({ url: target, exp: String(exp), sig });
  if (referer) qs.set("ref", referer);
  return `${req.baseUrl}/hls?${qs.toString()}`;
}

function rewritePlaylist(text: string, sourceUrl: string, req: Request, referer?: string | null): string {
  const base = new URL(sourceUrl);
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("#")) {
        // Rewrite URI="..." attributes (EXT-X-KEY, EXT-X-MEDIA audio/subtitle groups, etc.)
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
          const abs = new URL(uri, base).toString();
          return `URI="${buildProxyUrl(req, abs, referer)}"`;
        });
      }
      const trimmed = line.trim();
      if (!trimmed) return line;
      const abs = new URL(trimmed, base).toString();
      return buildProxyUrl(req, abs, referer);
    })
    .join("\n");
}

router.get("/hls", async (req: Request, res: Response) => {
  const rawTarget = req.query.url as string | undefined;
  const referer = (req.query.ref as string | undefined) || undefined;
  const exp = req.query.exp as string | undefined;
  const sig = req.query.sig as string | undefined;

  if (!rawTarget) {
    return void res.status(400).json({ error: "Missing url" });
  }

  const signed = verifyProxySignature(rawTarget, referer, exp, sig);

  let target: URL;
  try {
    target = new URL(rawTarget);
    await assertSafeTarget(target, signed);
  } catch (e) {
    return void res.status(400).json({ error: "URL not allowed" });
  }
  // Referer is only ever set by our own server (listServers), but validate
  // its shape defensively too since it's forwarded upstream as a header.
  if (referer && !/^https?:\/\//i.test(referer)) {
    return void res.status(400).json({ error: "Invalid referer" });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { "User-Agent": UA };
    if (referer) headers.Referer = referer;
    if (req.headers.range) headers.Range = req.headers.range as string;

    const upstream = await fetch(target, { headers, signal: ac.signal });
    const contentType = upstream.headers.get("content-type") ?? "";
    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
      return void res.status(502).json({ error: "Upstream response too large" });
    }

    // Some mirrors serve a real playlist under a non-`.m3u8` path (seen:
    // AniNeko's StreamHG mirror using `.txt`) with a generic content-type,
    // so a small, text-ish, ambiguous response is worth peeking at — if it
    // isn't actually a playlist we still forward it untouched below.
    const looksAmbiguous =
      !isM3U8(target.toString(), contentType) &&
      contentLength > 0 && contentLength < 100_000 &&
      (contentType === "" || contentType.startsWith("text/") || contentType.includes("octet-stream"));

    if (isM3U8(target.toString(), contentType) || looksAmbiguous) {
      const text = await upstream.text();
      if (looksAmbiguous && !text.trimStart().startsWith("#EXTM3U")) {
        res.status(upstream.status);
        if (contentType) res.setHeader("Content-Type", contentType);
        res.send(text);
        return;
      }
      res.status(upstream.status);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.send(rewritePlaylist(text, target.toString(), req, referer));
      return;
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (["content-encoding", "transfer-encoding", "connection", "content-length"].includes(k)) return;
      res.setHeader(key, value);
    });

    if (!upstream.body) {
      res.end();
      return;
    }

    let sent = 0;
    const nodeStream = Readable.fromWeb(upstream.body as never);
    nodeStream.on("data", (chunk: Buffer) => {
      sent += chunk.length;
      if (sent > MAX_RESPONSE_BYTES) {
        nodeStream.destroy();
        if (!res.headersSent) res.status(502);
        res.end();
      }
    });
    nodeStream.pipe(res);
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: "Proxy fetch failed" });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
