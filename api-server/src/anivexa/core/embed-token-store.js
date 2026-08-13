/**
 * Server-side embed URL token store.
 *
 * Instead of encoding the upstream embed URL as a base64url query parameter
 * (decodable by anyone reading the network tab), we store the URL in memory
 * and hand out a short-lived opaque random token.  The browser only ever
 * sees the token; the real URL never leaves the server as plain text.
 *
 * Light security:
 *   - Token TTL: 4 hours (generous, no risk of mid-session expiry)
 *   - The token is used as the XOR key in the iframe shell — so even when
 *     the URL is embedded in the HTML, it's obfuscated, not plain text.
 *   - No rotation, no IP binding — keeps things simple and reliable.
 *
 * This is "not easily visible on the front" — a casual DevTools user sees
 * only an opaque token in the network tab. A determined reverse-engineer
 * can still recover the URL (acceptable trade-off, as the user said).
 */

import { randomBytes } from "node:crypto";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — generous, no mid-session expiry

// Map<token, { url, expires }>
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
