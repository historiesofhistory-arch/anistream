// Megaplay provider — returns a direct embeddable iframe URL.
// URL format: https://megaplay.buzz/stream/ani/{anilistId}/{epNum}/{audio}
// Both sub and dub are supported when the source has them.
// No scraping/extraction needed — the Megaplay player is a normal embeddable
// iframe that handles its own stream resolution internally.

import { json } from "../core/new-provider-utils.js";

const BASE = "https://megaplay.buzz";

async function handleWatch(anilistId, audio, epNum) {
  const embedUrl = `${BASE}/stream/ani/${anilistId}/${epNum}/${audio === "dub" ? "dub" : "sub"}`;
  return json({
    anilistId: Number(anilistId),
    episode:   Number(epNum),
    audio,
    streams: [
      {
        url:      embedUrl,
        type:     "embed",
        server:   `Megaplay-${audio === "dub" ? "Dub" : "Sub"}`,
        isActive: true,
      },
    ],
  });
}

export async function getAudioOptions(anilistId, _epNum) {
  // Megaplay generally carries both sub and dub for most anime.
  // We optimistically report both; the player itself will fall back to
  // whatever it actually has for the given AniList ID + episode.
  return [
    { code: "sub", label: "Japanese" },
    { code: "dub", label: "English" },
  ];
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
      const m = url.pathname.match(/^\/watch\/megaplay\/(\d+)\/(sub|dub)\/megaplay-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, stack: err.stack }, 500);
    }
  },
};
