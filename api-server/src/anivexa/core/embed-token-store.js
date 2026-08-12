/**
 * Server-side embed URL token store.
 *
 * Instead of encoding the upstream embed URL (Koyeb domain, FlixCloud, etc.)
 * as a base64url query parameter — which anyone can decode from the network
 * tab — we store the URL in memory and hand out a short-lived opaque random
 * token.  The browser only ever sees the token; the real URL never leaves
 * the server.
 *
 * Token lifetime: 4 hours (generous enough for a long watch session).
 * Expired tokens are purged lazily on the next createToken() call.
 */

import { randomBytes } from "node:crypto";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Map<token, { url: string, expires: number }>
const store = new Map();

/**
 * Store `url` and return a fresh opaque token.
 */
export function createToken(url) {
  // Lazy purge of expired entries to keep memory bounded.
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expires) store.delete(k);
  }

  const token = randomBytes(24).toString("base64url"); // 32 URL-safe chars
  store.set(token, { url, expires: now + TOKEN_TTL_MS });
  return token;
}

/**
 * Look up a token.  Returns the URL string, or null if missing / expired.
 */
export function lookupToken(token) {
  if (!token) return null;
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(token);
    return null;
  }
  return entry.url;
}
