import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Continue Watching — localStorage based history (NO server storage)
//
// When a user clicks an episode on the watch page, we save:
//   - animeId, episodeId, episodeNumber
//   - anime title + poster URL (for display)
//   - timestamp (for sorting)
//
// All data lives in the browser's localStorage. No server calls, no account,
// no DB. If the user clears browser data, history is gone (intentional).
//
// The history is capped at 24 entries — older entries are pruned.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContinueWatchingEntry {
  animeId:        number;
  episodeId:      number;
  episodeNumber:  number;
  title:          string;
  posterUrl:      string;
  watchedAt:      number;  // ms timestamp
}

const STORAGE_KEY = "anistream:continue-watching";
const MAX_ENTRIES = 24;

function readFromStorage(): ContinueWatchingEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContinueWatchingEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e =>
      typeof e.animeId === "number" &&
      typeof e.episodeId === "number" &&
      typeof e.title === "string" &&
      typeof e.posterUrl === "string"
    );
  } catch {
    return [];
  }
}

function writeToStorage(entries: ContinueWatchingEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage might be full or disabled — fail silently
  }
}

/**
 * Save an episode to continue watching history.
 * If the same anime already exists, update its episode + timestamp.
 * The list is sorted by most recently watched first.
 */
export function saveToContinueWatching(entry: Omit<ContinueWatchingEntry, "watchedAt">) {
  const entries = readFromStorage();
  // Remove any existing entry for this anime (so we don't show duplicates)
  const filtered = entries.filter(e => e.animeId !== entry.animeId);
  // Prepend the new entry
  const newEntry: ContinueWatchingEntry = { ...entry, watchedAt: Date.now() };
  const updated = [newEntry, ...filtered].slice(0, MAX_ENTRIES);
  writeToStorage(updated);
  // Dispatch a custom event so other components (like the homepage) can
  // reactively update without re-reading localStorage on a timer.
  window.dispatchEvent(new CustomEvent("anistream:continue-watching-updated"));
}

/**
 * React hook that returns the continue watching list, sorted by most recent.
 * Automatically updates when a new entry is saved (via custom event).
 */
export function useContinueWatching(): ContinueWatchingEntry[] {
  const [entries, setEntries] = useState<ContinueWatchingEntry[]>([]);

  useEffect(() => {
    // Initial read
    setEntries(readFromStorage());

    // Listen for updates from saveToContinueWatching
    const handler = () => setEntries(readFromStorage());
    window.addEventListener("anistream:continue-watching-updated", handler);
    // Also listen for storage events (other tabs)
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) handler();
    });

    return () => {
      window.removeEventListener("anistream:continue-watching-updated", handler);
    };
  }, []);

  return entries;
}

/**
 * Clear the entire continue watching history.
 */
export function clearContinueWatching() {
  writeToStorage([]);
  window.dispatchEvent(new CustomEvent("anistream:continue-watching-updated"));
}

/**
 * Remove a single anime from continue watching.
 */
export function removeFromContinueWatching(animeId: number) {
  const entries = readFromStorage();
  const updated = entries.filter(e => e.animeId !== animeId);
  writeToStorage(updated);
  window.dispatchEvent(new CustomEvent("anistream:continue-watching-updated"));
}
