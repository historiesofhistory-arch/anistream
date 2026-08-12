/**
 * API base URL resolver.
 *
 * All API/embed URLs in this app are relative ("/api/..."). By default they
 * resolve against the same origin the frontend is served from — which is what
 * you want when frontend and backend are deployed together (e.g. Replit, or a
 * single Docker container serving both static files and /api).
 *
 * If you host the API elsewhere (e.g. on Koyeb, Railway, or any other domain
 * like `https://myapi.koyeb.app` or `https://stream-foo.anix.at`), set:
 *
 *   VITE_API_BASE_URL=https://myapi.koyeb.app
 *
 * in your `.env` file (or your hosting provider's env vars). Every `/api/...`
 * call will then be prefixed with that origin automatically — no code changes
 * needed. The env var is read at BUILD time (Vite inlines `VITE_*` vars), so
 * rebuild after changing it.
 *
 * Trailing slash is stripped to avoid `//api/...` in the final URL.
 *
 * Example:
 *   apiUrl("/api/anime/123/details")
 *     → "/api/anime/123/details"                       (same-origin, default)
 *     → "https://myapi.koyeb.app/api/anime/123/details" (with VITE_API_BASE_URL)
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? "").trim();

// Strip trailing slash(es) so we never produce `//api/...`.
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");

/**
 * Resolve a relative `/api/...` path against the configured API base URL.
 *
 * Pass-through for absolute URLs (http://, https://, //) and non-/api paths —
 * those are returned unchanged so this is safe to wrap around any URL.
 */
export function apiUrl(path: string): string {
  if (!path) return path;
  // Absolute URL → return as-is
  if (/^(https?:)?\/\//.test(path)) return path;
  // If a base URL is configured AND the path starts with /api/, prepend the base
  if (API_BASE_URL && path.startsWith("/api/")) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}
