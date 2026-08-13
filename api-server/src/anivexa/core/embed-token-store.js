/**
 * Server-side embed URL token store.
 *
 * Instead of encoding the upstream embed URL (Koyeb domain, FlixCloud, etc.)
 * as a base64url query parameter — which anyone can decode from the network
 * tab — we store the URL in memory and hand out a short-lived opaque random
 * token.  The browser only ever sees the token; the real URL never leaves
 * the server.
 *
 * Token lifetime: 1 hour (one watch session — shorter = safer).
 * Expired tokens are purged lazily on the next createToken() call.
 *
 * Token rotation: after ROTATE_AFTER_MS of use, the token is invalidated
 * and a fresh one is minted.  This means a token extracted from the
 * Network tab via DevTools becomes useless after the rotation window —
 * even if the attacker shares it on Discord/Reddit, others can't use it.
 *
 * Per-IP binding (optional): when `req` is passed to BOTH createToken AND
 * lookupToken, the token is bound to the requesting IP and can't be reused
 * from a different IP.  Threaded through the stream-handler chain.
 */

import { randomBytes } from "node:crypto";

const TOKEN_TTL_MS    = 60 * 60 * 1000;   // 1 hour (one watch session)
const ROTATE_AFTER_MS = 5 * 60 * 1000;    // rotate token after 5 min of use

// Map<token, { url, ip, expires, createdAt, usedCount }>
const store = new Map();

/**
 * Best-effort client-IP extraction.  Respects X-Forwarded-For (set by
 * Render/Railway's load balancers) and falls back to the socket remote address.
 */
function clientIp(req) {
  const xff = req?.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0];
    return first ? first.trim() : null;
  }
  const fly = req?.headers?.["fly-client-ip"];
  if (typeof fly === "string" && fly.length > 0) return fly;
  return req?.socket?.remoteAddress ?? null;
}

/**
 * Store `url` and return a fresh opaque token.
 * If `req` is passed, the token is bound to the requesting IP.
 */
export function createToken(url, req) {
  // Lazy purge of expired entries to keep memory bounded.
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expires) store.delete(k);
  }

  const token = randomBytes(24).toString("base64url"); // 32 URL-safe chars
  const ip    = req ? clientIp(req) : null;
  store.set(token, {
    url,
    ip:         ip || null,
    expires:    now + TOKEN_TTL_MS,
    createdAt:  now,
    usedCount:  0,
  });
  return token;
}

/**
 * Look up a token.  Returns `{ url, rotatedToken? }` on success, or `null`
 * if missing / expired / IP mismatch.
 *
 * - If the requesting IP doesn't match the creator IP (when IP binding
 *   is active), the token is revoked and denied.
 * - If the token has been in use longer than ROTATE_AFTER_MS, a fresh
 *   token is minted and the old one is invalidated.  The route layer can
 *   use `rotatedToken` to redirect the client.
 */
export function lookupToken(token, req) {
  if (!token) return null;
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(token);
    return null;
  }

  // ── Per-IP binding (only enforced when entry has an IP) ──────────────────
  if (entry.ip && req) {
    const creatorIp  = String(entry.ip).replace(/^::ffff:/, "");
    const requesting = String(clientIp(req) || "").replace(/^::ffff:/, "");
    if (creatorIp && requesting && creatorIp !== requesting) {
      store.delete(token);
      return null;
    }
  }

  entry.usedCount++;

  // ── Token rotation ────────────────────────────────────────────────────────
  if (Date.now() - entry.createdAt > ROTATE_AFTER_MS) {
    const newToken = randomBytes(24).toString("base64url");
    store.set(newToken, {
      url:        entry.url,
      ip:         entry.ip,
      expires:    entry.expires,        // keep original expiry
      createdAt:  Date.now(),
      usedCount:  0,
    });
    store.delete(token);
    return { url: entry.url, rotatedToken: newToken };
  }

  return { url: entry.url };
}
