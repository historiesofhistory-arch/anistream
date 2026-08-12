import crypto from "node:crypto";

// PROXY_SECRET signs every proxy URL (both the local /api/proxy/hls route
// and the Cloudflare Worker).  Falls back to SESSION_SECRET for backward
// compatibility with existing deployments, then to a dev-only constant.
// In production PROXY_SECRET (or SESSION_SECRET) MUST be set.
const SECRET =
  process.env.PROXY_SECRET ??
  process.env.SESSION_SECRET ??
  (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PROXY_SECRET must be set in production — it signs proxy URLs and cannot fall back to a default.",
      );
    }
    return "anivexa-proxy-fallback-secret-dev-only";
  })();

const TTL_MS = 6 * 60 * 60 * 1000; // 6 h — longer than any single watch session

// When CF_WORKER_URL is set, signProxyUrl() returns a Cloudflare Worker URL
// instead of the local /api/proxy route.  The Worker is globally distributed
// so it picks up the stream from the CDN much closer to the viewer.
// Falls back to the local proxy when the env var is absent.
const CF_WORKER_URL = process.env.CF_WORKER_URL?.replace(/\/+$/, "") ?? null;

export function sign(url, referer, exp) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${url}|${referer ?? ""}|${exp}`)
    .digest("base64url")
    .slice(0, 32);
}

export const PROXY_SIGNATURE_TTL_MS = TTL_MS;

/**
 * Build a signed proxy URL.
 * Routes through the Cloudflare Worker when CF_WORKER_URL is configured,
 * otherwise falls back to the local /api/proxy/hls route.
 */
export function signProxyUrl(url, referer) {
  const exp  = Date.now() + TTL_MS;
  const sig  = sign(url, referer, exp);
  const qs   = new URLSearchParams({ url, exp: String(exp), sig });
  if (referer) qs.set("ref", referer);
  const base = CF_WORKER_URL ?? "/api/proxy";
  return `${base}/hls?${qs.toString()}`;
}

/** Verify a signature previously produced by signProxyUrl. */
export function verifyProxySignature(url, referer, exp, sig) {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = sign(url, referer, expNum);
  // Constant-time comparison to avoid timing side-channels.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
