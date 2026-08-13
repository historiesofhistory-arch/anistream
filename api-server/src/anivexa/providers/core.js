// Core provider — embed server (Koyeb-hosted by default, configurable).
// Supports sub, dub, and hsub (hard-subtitled).
// Marked as the recommended default for AniStream.
//
// URL: GET {EMBED_API_URL}/api/stream/anix.at/{anilistId}/{epNum}/{type}/co
// type: "sub" | "dub" | "hsub"
//
// The embed API origin is read from the EMBED_API_URL env var. If unset,
// falls back to the public Koyeb-hosted instance. Set EMBED_API_URL in your
// environment to point at your own hosted instance.

import { json } from "../core/new-provider-utils.js";

const EMBED_API_URL = (process.env.EMBED_API_URL || "https://worthwhile-audrey-botnestbots-d45e9faf.koyeb.app")
  .replace(/\/+$/, ""); // strip trailing slash(es)

// ── Availability probe ─────────────────────────────────────────────────────
// Koyeb always returns HTTP 200, but unavailable streams return a short
// plain-text body: "error code: 502" (~16 bytes).
// Valid embed pages are 200+ bytes of HTML with an iframe inside.

const PROBE_CACHE = new Map(); // url → { ok: bool, expires: number }
const PROBE_TTL   = 10 * 60 * 1000; // 10 minutes
const PROBE_ERR   = 60 * 1000;      // 1 minute TTL on failures

async function probeEmbed(url) {
  const now    = Date.now();
  const cached = PROBE_CACHE.get(url);
  if (cached && now < cached.expires) return cached.ok;
  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const text = await res.text();
    // Valid pages are HTML (200+ bytes); errors are short plain-text
    const ok   = text.length >= 200 && !text.includes("error code:");
    PROBE_CACHE.set(url, { ok, expires: now + (ok ? PROBE_TTL : PROBE_ERR) });
    return ok;
  } catch {
    PROBE_CACHE.set(url, { ok: false, expires: now + PROBE_ERR });
    return false;
  }
}

function embedUrl(anilistId, epNum, type) {
  return `${EMBED_API_URL}/api/stream/anix.at/${anilistId}/${epNum}/${type}/co`;
}

async function handleWatch(anilistId, audio, epNum) {
  const type = audio === "dub" ? "dub" : audio === "hsub" ? "hsub" : "sub";
  const url  = embedUrl(anilistId, epNum, type);
  return json({
    anilistId: Number(anilistId),
    episode:   Number(epNum),
    audio,
    isHardSub: type === "hsub",
    streams: [{
      url,
      type:     "embed",
      server:   `Core-${type}`,
      isActive: true,
    }],
  });
}

// Real per-episode availability — probes using the ?p=am endpoint instead
// of the Core /co endpoint.
//
// WHY: Both Core (/co) and VidStream (?p=vs) use megaplay.buzz as their
// inner player. Megaplay always returns a full player HTML template
// (~666 bytes) regardless of whether the audio track actually exists —
// so a length/keyword probe of the Koyeb page can never distinguish
// "dub available" from "dub not released yet".
//
// The ?p=am endpoint (AniNico's backend) uses vivibebe.site as its
// inner player, which correctly returns a short error body when the
// track doesn't exist. Probing ?p=am gives us accurate availability
// information that applies equally to the Core stream (same anix.at
// source data).
const PROBE_BASE_AM = EMBED_API_URL + "/api/stream/anix.at";

function probeUrl(anilistId, epNum, type) {
  return `${PROBE_BASE_AM}/${anilistId}/${epNum}/${type}?p=am`;
}

export async function getAudioOptions(anilistId, epNum) {
  const types = [
    { code: "sub",  label: "Japanese",  url: probeUrl(anilistId, epNum, "sub")  },
    { code: "dub",  label: "English",   url: probeUrl(anilistId, epNum, "dub")  },
    { code: "hsub", label: "JPN H-Sub", url: probeUrl(anilistId, epNum, "hsub") },
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
      const m = url.pathname.match(/^\/watch\/core\/(\d+)\/(sub|dub|hsub)\/core-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, stack: err.stack }, 500);
    }
  },
};
