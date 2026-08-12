// AniNico provider — uses the embed API with the AniNico server (?p=am).
// The API returns an embeddable HTML page directly; the frontend renders it
// as an iframe. Supports sub, dub, and hsub (hard-subtitled).
//
// Availability is probed per-episode: the embed API always returns HTTP 200,
// but unavailable streams return a short error body ("error code: 502" ≈ 16
// bytes). Valid embed pages are 200+ bytes of HTML with an iframe inside.
//
// Endpoint: GET {EMBED_API_URL}/api/stream/anix.at/{anilistId}/{epNum}/{type}?p=am
// type: "sub" | "dub" | "hsub"
//
// EMBED_API_URL is read from env (defaults to the original Koyeb URL).
// Set it in .env to point at your own hosted instance.

import { json } from "../core/new-provider-utils.js";

const EMBED_API_URL = (process.env.EMBED_API_URL || "https://worthwhile-audrey-botnestbots-d45e9faf.koyeb.app")
  .replace(/\/+$/, "");

// ── Availability probe ─────────────────────────────────────────────────────
const PROBE_CACHE = new Map(); // url → { ok: bool, expires: number }
const PROBE_TTL   = 10 * 60 * 1000; // 10 minutes for successful probes
const PROBE_ERR   = 60 * 1000;       // 1 minute for failed probes

async function probeEmbed(url) {
  const now    = Date.now();
  const cached = PROBE_CACHE.get(url);
  if (cached && now < cached.expires) return cached.ok;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const text = await res.text();
    // Valid pages are HTML (200+ bytes); Koyeb errors are short plain-text
    const ok   = text.length >= 200 && !text.includes("error code:");
    PROBE_CACHE.set(url, { ok, expires: now + (ok ? PROBE_TTL : PROBE_ERR) });
    return ok;
  } catch {
    PROBE_CACHE.set(url, { ok: false, expires: now + PROBE_ERR });
    return false;
  }
}

function embedUrl(anilistId, epNum, type) {
  return `${EMBED_API_URL}/api/stream/anix.at/${anilistId}/${epNum}/${type}?p=am`;
}

function resolveType(audio) {
  if (audio === "dub")  return "dub";
  if (audio === "hsub") return "hsub";
  return "sub";
}

async function handleWatch(anilistId, audio, epNum) {
  const type = resolveType(audio);
  const url  = embedUrl(anilistId, epNum, type);
  return json({
    anilistId: Number(anilistId),
    episode:   Number(epNum),
    audio,
    isHardSub: type === "hsub",
    streams: [
      {
        url,
        type:     "embed",
        server:   `AniNico-${type}`,
        isActive: true,
      },
    ],
  });
}

// Real per-episode availability — probes sub, dub, and hsub in parallel.
// Only returns options where the Koyeb server actually has content.
export async function getAudioOptions(anilistId, epNum) {
  const types = [
    { code: "sub",  label: "Japanese",   url: embedUrl(anilistId, epNum, "sub")  },
    { code: "dub",  label: "English",    url: embedUrl(anilistId, epNum, "dub")  },
    { code: "hsub", label: "JPN H-Sub",  url: embedUrl(anilistId, epNum, "hsub") },
  ];
  const checks = await Promise.all(types.map(async (t) => ({ ...t, ok: await probeEmbed(t.url) })));
  return checks.filter((t) => t.ok).map(({ code, label }) => ({ code, label }));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }
    try {
      const m = url.pathname.match(/^\/watch\/aninico\/(\d+)\/(sub|dub|hsub)\/aninico-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, stack: err.stack }, 500);
    }
  },
};
