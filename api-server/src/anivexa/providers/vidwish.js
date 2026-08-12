// VidWish provider — resolves to a direct embeddable iframe URL (no HLS
// extraction). VidWish has no public search of its own; the only way to
// reach a specific anime/episode is through the "realId" that Megaplay's
// embed page hands back for the same title/episode, so we resolve that
// first and then hand the caller VidWish's own embed URL untouched — the
// frontend renders it as an <iframe>, exactly like the provider intends.
import { json } from "../core/new-provider-utils.js";

const MEGAPLAY = "https://megaplay.buzz";
const VIDWISH = "https://vidwish.live";
const SPOOF_REF = "https://hianimes.re/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function httpGet(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*", ...headers } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} fetching ${url}`);
    err.rawBody = await res.text().catch(() => null);
    throw err;
  }
  return res.text();
}

function attr(html, name) {
  const m = html.match(new RegExp(`data-${name}="([^"]*)"`));
  return m ? m[1] : null;
}

// Same two-step resolution AniKoto's Megaplay bridge uses: the direct
// `/stream/ani/...` URL either already carries the player's data attrs, or
// hands back an <iframe> pointing at the real embed which does.
async function resolveRealId(anilistId, audio, epNum) {
  let embedUrl = `${MEGAPLAY}/stream/ani/${anilistId}/${epNum}/${audio}`;
  let html = await httpGet(embedUrl, { Referer: SPOOF_REF, "Accept-Language": "en-US,en;q=0.9" }).catch(() => "");
  const frameSrc = html.match(/<iframe\b[^>]*src="([^"]+)"/i)?.[1];
  if (!attr(html, "id") && frameSrc) {
    embedUrl = frameSrc.startsWith("http") ? frameSrc : `${MEGAPLAY}${frameSrc}`;
    html = await httpGet(embedUrl, { Referer: SPOOF_REF, "Accept-Language": "en-US,en;q=0.9" }).catch(() => "");
  }
  return attr(html, "realid");
}

async function handleWatch(anilistId, audio, epNum) {
  const realId = await resolveRealId(anilistId, audio, Number(epNum));
  if (!realId) {
    return json({ anilistId: Number(anilistId), episode: Number(epNum), audio, streams: [] });
  }
  const embedUrl = `${VIDWISH}/stream/s-2/${realId}/${audio}`;
  return json({
    anilistId: Number(anilistId),
    episode: Number(epNum),
    audio,
    streams: [{ url: embedUrl, type: "embed", server: "VidWish", referer: `${VIDWISH}/`, isActive: true }],
  });
}

// VidWish (via Megaplay) generally carries both audio tracks; real
// per-episode availability is only knowable by actually resolving the
// realId, which is too slow to do just for the audio picker — real
// unavailability still surfaces correctly at stream-fetch time and the
// caller's provider fallback moves on to the next server automatically.
export async function getAudioOptions() {
  return [
    { code: "sub", label: "Japanese" },
    { code: "dub", label: "English" },
  ];
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "*" } });
    }
    try {
      const m = url.pathname.match(/^\/watch\/vidwish\/(\d+)\/(sub|dub)\/vidwish-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, "Raw-ERROR": err.rawBody ?? null, stack: err.stack }, 500);
    }
  },
};
