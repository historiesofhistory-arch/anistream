import { get, set, isFresh, SHOW_IDENTITY_TTL } from "./smartcache.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Some providers (AniNeko, AniZone) serve a valid-looking master.m3u8 but
// swap every actual segment for a decoy (an ad-network image, not video)
// when the request doesn't carry the session cookies their site sets while
// a real browser navigates search → series page → watch page → embed.
// A plain fetch() per call never accumulates those cookies. curl with a
// persistent cookie jar file — reused across every call for the same
// provider — lets each request inherit cookies set by the ones before it,
// exactly like a real browser session. This is the same trick already used
// by anidbapp.js to get past its Cloudflare challenge.
export async function curlFetch(url, { jarPath, referer, headers = [], extraArgs = [] } = {}) {
  const args = [
    "-s",
    "--compressed",
    "-A", UA,
    ...(jarPath ? ["-c", jarPath, "-b", jarPath] : []),
    "-w", "\n__STATUS:%{http_code}",
    ...(referer ? ["-H", `Referer: ${referer}`] : []),
    ...headers.flatMap((h) => ["-H", h]),
    ...extraArgs,
    url,
  ];
  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 16 * 1024 * 1024 });
  const sep = stdout.lastIndexOf("\n__STATUS:");
  const status = sep >= 0 ? Number(stdout.slice(sep + 10)) : 0;
  const body = sep >= 0 ? stdout.slice(0, sep) : stdout;
  if (status < 200 || status >= 300) {
    const err = new Error(`HTTP ${status} fetching ${url}`);
    err.rawBody = body;
    throw err;
  }
  return body;
}

// Session-aware HTML fetch: same signature/behaviour as fetchHtml, but
// backed by curlFetch + a persistent per-provider cookie jar so cookies
// set on one request (e.g. the series page) are sent on the next (e.g. the
// episode embed) — needed by sites that gate real video segments behind a
// session cookie established during normal navigation.
// Decodes the classic Dean Edwards "eval(function(p,a,c,k,e,d){...})" JS
// packer used by StreamHG/Earnvids/VidHide-style embed clones to hide their
// real player setup (and therefore their real HLS URL) from casual
// scraping. `packedSrc` is the inner argument list text, e.g. the contents
// between `eval(function(p,a,c,k,e,d){...}(` and the matching `))`.
export function unpackJs(packedArgsSrc) {
  const [p, a, c, kStr] = new Function(`return [${packedArgsSrc}];`)();
  const k = typeof kStr === "string" ? kStr.split("|") : kStr;
  let cc = c;
  const d = {};
  while (cc--) d[cc.toString(a)] = k[cc] || cc.toString(a);
  return p.replace(/\b\w+\b/g, (word) => (d[word] !== undefined ? d[word] : word));
}

// Extracts and unpacks the first Dean Edwards packed script in `html`, if
// any. Returns the decoded JS source, or null if the page isn't packed.
export function unpackEmbedScript(html) {
  const m = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\((.*?)\)\)\s*<\/script>/);
  if (!m) return null;
  try {
    return unpackJs(m[1]);
  } catch {
    return null;
  }
}

// StreamHG/Earnvids-style players declare `var links = {...}` (a map of
// quality keys like hls2/hls3/hls4 to signed CDN URLs) and then pick one
// via a JS OR-chain such as `links.hls4||links.hls3||links.hls2`. This
// resolves that chain against the real object so we get the actual URL the
// player would have used, in the same priority order.
export function resolveLinksChain(decodedJs) {
  const linksMatch = decodedJs.match(/var\s+links\s*=\s*(\{[^;]*?\})\s*;/);
  if (!linksMatch) return null;
  let links;
  try {
    links = new Function(`return ${linksMatch[1]};`)();
  } catch {
    return null;
  }
  // Our HLS proxy only rewrites child playlist/segment URIs when it
  // recognizes a response as an m3u8 (by extension or content-type) — some
  // mirrors in the chain point at the same content under a `.txt` path
  // instead, which the proxy would pass through unrewritten and break
  // relative segment URIs. Prefer a `.m3u8`-suffixed candidate first, only
  // falling back to the JS's own OR-chain order if none qualifies.
  const chainMatch = decodedJs.match(/file\s*:\s*(links(?:\.\w+|\|\|)+)/);
  const orderedKeys = chainMatch
    ? chainMatch[1].split("||").map((k) => k.trim().replace(/^links\./, ""))
    : Object.keys(links);
  const candidates = orderedKeys.map((k) => links[k]).filter(Boolean);
  const m3u8First = candidates.find((url) => /\.m3u8(\?|$)/i.test(url));
  if (m3u8First) return m3u8First;
  if (candidates.length) return candidates[0];
  // Fall back to any hls-labelled entry in the object.
  return Object.entries(links).find(([k]) => /hls/i.test(k))?.[1] ?? Object.values(links)[0] ?? null;
}

export function makeSessionFetch(jarPath) {
  return async function sessionFetchHtml(url, headers = {}) {
    const referer = headers.Referer ?? headers.referer;
    const extraHeaders = Object.entries(headers)
      .filter(([k]) => k.toLowerCase() !== "referer")
      .map(([k, v]) => `${k}: ${v}`);
    return curlFetch(url, { jarPath, referer, headers: extraHeaders });
  };
}

const RELATION_FRAGMENT = `edges{relationType(version:2) node{id type episodes relations{edges{relationType(version:2) node{id type episodes relations{edges{relationType(version:2) node{id type episodes relations{edges{relationType(version:2) node{id type episodes}}}}}}}}}}}`;

export async function fetchHtml(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

export function decodeEntities(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function stripTags(html = "") {
  return decodeEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

export function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

export function norm(s = "") {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function diceCoeff(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const bigrams = new Map();
  for (let i = 0; i < na.length - 1; i++) {
    const bg = na.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < nb.length - 1; i++) {
    const bg = nb.slice(i, i + 2);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      hits++;
      bigrams.set(bg, count - 1);
    }
  }
  return (2 * hits) / (na.length + nb.length - 2);
}

export function titleScore(query, candidate, slug) {
  const base = Math.max(diceCoeff(query, candidate), diceCoeff(query, slug.replace(/-/g, " ")));
  const queryFirstNum = norm(query).match(/\d+/)?.[0] ?? "";
  const slugFirstNum = slug.match(/\d+/)?.[0] ?? "";
  if (queryFirstNum && slugFirstNum && queryFirstNum !== slugFirstNum) return base * 0.65;
  if (queryFirstNum && !slugFirstNum) return base * 0.65;
  if (!queryFirstNum && slugFirstNum) {
    const n = parseInt(slugFirstNum);
    if (n > 1 && n < 1900) return base * (1 - 0.06 * (n - 1));
  }
  const isMovieQuery = /\b(movie|film|the movie)\b/i.test(query);
  const isMovieMatch = /\b(movie|film)\b/i.test(candidate) || /movie|film/.test(slug);
  if (isMovieQuery && !isMovieMatch) return base * 0.4;
  const qLen = norm(query).length;
  const sLen = norm(slug.replace(/-/g, " ")).length;
  return sLen > qLen * 1.6 + 4 ? base * 0.8 : base;
}

function buildSearchQueries(title) {
  const queries = new Set([title]);
  const words = title.trim().split(/\s+/);
  if (words.length > 4) queries.add(words.slice(0, 4).join(" "));
  if (words.length > 3) queries.add(words.slice(0, 3).join(" "));
  const stripped = title
    .replace(/\bseason\s*\d+\b/gi, "")
    .replace(/\bpart\s*\d+\b/gi, "")
    .replace(/\b\d+rd\b|\b\d+th\b|\b\d+st\b|\b\d+nd\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped !== title) queries.add(stripped);
  return [...queries].filter((q) => q.length >= 3);
}

export async function findTopSlugs(titles, searchFn, n = 6) {
  const allCandidates = new Map();
  const searchQueries = new Set();
  for (const title of titles.slice(0, 4)) {
    for (const q of buildSearchQueries(title)) searchQueries.add(q);
  }
  await Promise.all([...searchQueries].map(async (q) => {
    try {
      const results = await searchFn(q);
      for (const r of results) if (!allCandidates.has(r.slug)) allCandidates.set(r.slug, r.text);
    } catch {}
  }));
  const scored = [];
  for (const [slug, text] of allCandidates) {
    let best = 0;
    for (const title of titles.slice(0, 2)) best = Math.max(best, titleScore(title, text, slug));
    if (best >= 0.5) scored.push({ slug, title: text, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}

async function anilistQuery(query, variables) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`);
  return json.data;
}

function computePrequelOffset(relations, depth = 0) {
  if (!relations || depth > 5) return 0;
  const prequelEdge = relations.edges?.find(
    (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME" && (e.node.episodes ?? 0) >= 5
  );
  if (!prequelEdge) return 0;
  return (prequelEdge.node.episodes ?? 0) + computePrequelOffset(prequelEdge.node.relations, depth + 1);
}

export async function getPrequelOffset(anilistId) {
  const key = `np-offset:${anilistId}`;
  const entry = get(key);
  if (isFresh(entry)) return entry.data;
  const data = await anilistQuery(
    `query($id:Int){Media(id:$id,type:ANIME){relations{${RELATION_FRAGMENT}}}}`,
    { id: Number(anilistId) }
  );
  const offset = computePrequelOffset(data?.Media?.relations);
  set(key, offset, SHOW_IDENTITY_TTL);
  return offset;
}

export function buildTitles(media, anizip) {
  return [
    media?.title?.english,
    media?.title?.romaji,
    media?.title?.native,
    ...(media?.synonyms ?? []),
    anizip?.titles?.en,
    anizip?.titles?.["x-jat"],
    anizip?.titles?.ja,
  ].filter(Boolean);
}

export function expectedCount(media, anizip, jikanEps) {
  const counts = [
    media?.episodes,
    ...Object.keys(anizip?.episodes ?? {}).map(Number).filter(Number.isFinite),
    ...(jikanEps ?? []).map((e) => e.mal_id).filter(Number.isFinite),
  ].filter((n) => Number.isFinite(n) && n > 0);
  return counts.length ? Math.max(...counts) : null;
}

export function episodeMeta(n, ctx) {
  const az = ctx.anizip?.episodes?.[String(n)] ?? {};
  const jk = (ctx.jikanEps ?? []).find((e) => Number(e.mal_id) === Number(n));
  const runtime = az.runtime ?? az.length ?? null;
  return {
    title: jk?.title ?? az.title?.en ?? az.title?.["x-jat"] ?? null,
    duration: runtime ? runtime * 60 : null,
    filler: jk?.filler ?? az.filler ?? false,
    uncensored: false,
    description: az.overview ?? az.summary ?? null,
    image: az.image ?? ctx.anizip?.images?.cover ?? null,
    airDate: jk?.aired ?? az.airdate ?? az.aired ?? null,
  };
}

export function selectSeries(candidates, scrapeSeries, expected, status, offset, options = {}) {
  return Promise.all(candidates.map(async (candidate) => {
    const episodes = await scrapeSeries(candidate.slug);
    const max = Math.max(0, ...episodes.map((e) => e.number));
    const localHits = expected ? episodes.filter((e) => e.number >= 1 && e.number <= expected).length : episodes.length;
    const offsetHits = expected && offset
      ? episodes.filter((e) => e.number > offset && e.number <= offset + expected).length
      : 0;
    const mode = offsetHits > localHits ? "offset" : "local";
    const hits = Math.max(localHits, offsetHits);
    let countScore = 1;
    if (expected && expected >= 6) {
      const needed = status === "FINISHED" ? Math.ceil(expected * 0.9) : Math.max(1, expected - 3);
      countScore = hits >= needed ? 1 : hits / needed;
    }
    return { ...candidate, episodes, max, mode, score: candidate.score * 0.7 + countScore * 0.3 };
  })).then((results) => {
    const minScore = options.minScore ?? 0.65;
    const viable = results
      .filter((r) => r.episodes.length && r.score >= minScore)
      .sort((a, b) => b.score - a.score);
    if (!viable.length) return null;
    return viable[0];
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
