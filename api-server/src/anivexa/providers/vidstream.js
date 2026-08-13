// VidStream provider — embed API using the ?p=vs server.
// Supports sub and dub only (no hsub).
//
// URL: GET {EMBED_API_URL}/api/stream/anix.at/{anilistId}/{epNum}/{type}?p=vs
// EMBED_API_URL MUST be set in your environment variables.

import { json } from "../core/new-provider-utils.js";

const EMBED_API_URL = (process.env.EMBED_API_URL || "")
  .replace(/\/+$/, "");

// ── Availability probe ─────────────────────────────────────────────────────
// Koyeb always returns HTTP 200, but unavailable streams return a short
// plain-text body: "error code: 502" (~16 bytes).
// Valid embed pages are 200+ bytes of HTML with an iframe inside.

const PROBE_CACHE = new Map(); // url → { ok: bool, expires: number }
const PROBE_TTL   = 10 * 60 * 1000;
const PROBE_ERR   = 60 * 1000;

async function probeEmbed(url) {
  const now    = Date.now();
  const cached = PROBE_CACHE.get(url);
  if (cached && now < cached.expires) return cached.ok;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const text = await res.text();
    const ok   = text.length >= 200 && !text.includes("error code:");
    PROBE_CACHE.set(url, { ok, expires: now + (ok ? PROBE_TTL : PROBE_ERR) });
    return ok;
  } catch {
    PROBE_CACHE.set(url, { ok: false, expires: now + PROBE_ERR });
    return false;
  }
}

function embedUrl(anilistId, epNum, type) {
  return `${EMBED_API_URL}/api/stream/anix.at/${anilistId}/${epNum}/${type}?p=vs`;
}

async function handleWatch(anilistId, audio, epNum) {
  const type = audio === "dub" ? "dub" : "sub";
  const url  = embedUrl(anilistId, epNum, type);
  return json({
    anilistId: Number(anilistId),
    episode:   Number(epNum),
    audio,
    streams: [{
      url,
      type:     "embed",
      server:   `VidStream-${type}`,
      isActive: true,
    }],
  });
}

// Real per-episode availability — probes using the ?p=am endpoint.
//
// WHY: VidStream uses megaplay.buzz which always returns a player HTML
// template regardless of whether the audio track exists. The ?p=am
// endpoint (AniNico backend) uses vivibebe.site, which correctly
// returns a short error body for missing tracks. Since all backends
// pull from the same anix.at source, ?p=am probe results apply to
// VidStream availability too.
//
// VidStream doesn't support hsub, so we only probe sub and dub.
const PROBE_BASE_AM = EMBED_API_URL + "/api/stream/anix.at";

function probeUrl(anilistId, epNum, type) {
  return `${PROBE_BASE_AM}/${anilistId}/${epNum}/${type}?p=am`;
}

export async function getAudioOptions(anilistId, epNum) {
  const types = [
    { code: "sub", label: "Japanese", url: probeUrl(anilistId, epNum, "sub") },
    { code: "dub", label: "English",  url: probeUrl(anilistId, epNum, "dub") },
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
      const m = url.pathname.match(/^\/watch\/vidstream\/(\d+)\/(sub|dub)\/vidstream-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, stack: err.stack }, 500);
    }
  },
};
