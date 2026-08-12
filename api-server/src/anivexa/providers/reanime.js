// ReAnime provider — resolves to a direct embeddable FlixCloud.cc iframe
// URL (no HLS extraction). FlixCloud pages carry a WASM-obfuscated blob
// that decodes to the real HLS URL, but that decode path is fragile and
// unnecessary here — the FlixCloud page itself is a normal embeddable
// player, so (like VidWish) we just hand the caller its URL untouched and
// let the frontend render it as an <iframe>. Both HD-1 and HD-2 mirrors are
// exposed, sub and dub both work whenever the source has them.
import { getMedia } from "../core/anilist.js";
import { buildTitles, json } from "../core/new-provider-utils.js";
import { get, set, isFresh, SHOW_IDENTITY_TTL } from "../core/smartcache.js";

const BASE = "https://reanime.to";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const H = { "User-Agent": UA, Accept: "application/json, */*" };

// HD-2 tends to be the more reliable mirror; try it first.
const SERVER_PRIORITY = { "HD-2": 0, "HD-1": 1 };
function byPriority(list) {
  return list.slice().sort((a, b) => (SERVER_PRIORITY[a.serverName] ?? 9) - (SERVER_PRIORITY[b.serverName] ?? 9));
}

async function getJson(url) {
  const res = await fetch(url, { headers: H });
  const raw = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} fetching ${url}`);
    err.rawBody = raw;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    e.rawBody = raw;
    throw e;
  }
}

async function searchReanime(query) {
  const data = await getJson(`${BASE}/api/v1/search?${new URLSearchParams({ q: query, limit: 10 })}`).catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

async function fetchAnimeDetail(animeId) {
  return getJson(`${BASE}/api/v1/anime/${animeId}`).catch(() => null);
}

async function resolveSeries(anilistId, ctx = {}) {
  const cacheKey = `np:reanime:${anilistId}`;
  const cached = get(cacheKey);
  if (isFresh(cached)) return cached.data;

  const media = ctx.media ?? await getMedia(anilistId);
  const malId = media?.idMal ?? null;
  const queries = buildTitles(media, ctx.anizip).slice(0, 5);

  const candidates = new Map();
  await Promise.all(queries.map(async (q) => {
    for (const r of await searchReanime(q)) {
      if (r?.anime_id && !candidates.has(r.anime_id)) candidates.set(r.anime_id, r);
    }
  }));

  const details = await Promise.all(
    [...candidates.keys()].map(async (id) => ({ id, detail: await fetchAnimeDetail(id) }))
  );

  for (const { id, detail } of details) {
    if (detail?.anilist_id && Number(detail.anilist_id) === Number(anilistId)) {
      const data = {
        animeId: id,
        title: detail.title?.english || detail.title?.romaji || candidates.get(id)?.title?.english || id,
        malId: detail.mal_id || null,
        subbed: Number.isFinite(detail.subbed) ? detail.subbed : null,
        dubbed: Number.isFinite(detail.dubbed) ? detail.dubbed : null,
        matchType: "anilist",
        matchScore: 1,
      };
      set(cacheKey, data, SHOW_IDENTITY_TTL);
      return data;
    }
  }

  if (malId) {
    for (const { id, detail } of details) {
      if (detail?.mal_id && Number(detail.mal_id) === Number(malId)) {
        const data = {
          animeId: id,
          title: detail.title?.english || detail.title?.romaji || id,
          malId: Number(detail.mal_id),
          subbed: Number.isFinite(detail.subbed) ? detail.subbed : null,
          dubbed: Number.isFinite(detail.dubbed) ? detail.dubbed : null,
          matchType: "mal",
          matchScore: 0.9,
        };
        set(cacheKey, data, SHOW_IDENTITY_TTL);
        return data;
      }
    }
  }

  throw new Error(`No confirmed reanime match for AniList ${anilistId}`);
}

// Pulls every server ReAnime knows about for this episode (its own
// `/api/watch` list plus the `/api/flix` list, deduped) — both are just
// metadata lookups, no embed page fetch/decrypt involved, so this stays
// cheap enough to call for both handleWatch and getAudioOptions.
async function fetchServers(slug, anilistId, epNum) {
  const [watchRes, flixRes] = await Promise.allSettled([
    getJson(`${BASE}/api/watch/${slug}/${epNum}`),
    getJson(`${BASE}/api/flix/${anilistId}/${epNum}`),
  ]);
  const watchData = watchRes.status === "fulfilled" ? watchRes.value : null;
  const flixData = flixRes.status === "fulfilled" ? flixRes.value : null;
  const links = [...(watchData?.episode_links ?? [])];
  if (flixData?.success && flixData?.servers) {
    const seen = new Set(links.map((s) => s["$id"]));
    for (const s of flixData.servers) {
      if (!seen.has(s["$id"])) links.push(s);
    }
  }
  return links;
}

function serversForAudio(links, audio) {
  const audioTypes = audio === "sub" ? ["sub", "s-sub"] : ["dub", "s-dub"];
  return byPriority(links.filter((s) => audioTypes.includes(s.dataType)));
}

// Direct flix lookup — works with only anilistId, no slug resolution needed.
// Used as a reliable fallback when resolveSeries fails (unmatched anime).
async function fetchFlixDirect(anilistId, epNum) {
  const res = await getJson(`${BASE}/api/flix/${anilistId}/${epNum}`).catch(() => null);
  if (!res?.success || !Array.isArray(res.servers)) return [];
  return res.servers;
}

async function resolveLinks(anilistId, epNum) {
  // Try slug-based lookup first (more servers), fall back to direct flix lookup
  try {
    const series = await resolveSeries(anilistId);
    const links  = await fetchServers(series.animeId, anilistId, epNum);
    if (links.length) return links;
  } catch { /* fall through */ }
  return fetchFlixDirect(anilistId, epNum);
}

async function handleWatch(anilistId, audio, epNum) {
  const links   = await resolveLinks(anilistId, epNum);
  const servers = serversForAudio(links, audio);
  if (!servers.length) {
    return json({ anilistId: Number(anilistId), episode: Number(epNum), audio, streams: [] });
  }
  return json({
    anilistId: Number(anilistId),
    episode: Number(epNum),
    audio,
    streams: servers.map((s, i) => ({
      url:      s.dataLink,
      type:     "embed",
      server:   `ReAnime-${s.serverName}`,
      isActive: i === 0,
    })),
  });
}

// Real per-episode sub/dub availability — uses same link resolution logic.
export async function getAudioOptions(anilistId, epNum) {
  const links   = await resolveLinks(anilistId, epNum).catch(() => []);
  const options = [];
  if (serversForAudio(links, "sub").length) options.push({ code: "sub", label: "Japanese" });
  if (serversForAudio(links, "dub").length) options.push({ code: "dub", label: "English" });
  return options;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "*" } });
    }
    try {
      const m = url.pathname.match(/^\/watch\/reanime\/(\d+)\/(sub|dub)\/reanime-(\d+)\/?$/);
      if (m) return await handleWatch(m[1], m[2], m[3]);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message, "Raw-ERROR": err.rawBody ?? null, stack: err.stack }, 500);
    }
  },
};
