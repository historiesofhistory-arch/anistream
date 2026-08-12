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
// The history is capped at 50 entries. If localStorage quota is exceeded,
// we progressively remove the OLDEST entries and retry until it fits.
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
const MAX_ENTRIES = 50;

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

function writeToStorage(entries: ContinueWatchingEntry[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    // localStorage is full — progressively remove oldest entries and retry
    let trimmed = [...entries];
    while (trimmed.length > 1) {
      trimmed.pop(); // remove last (oldest) entry
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return true;
      } catch {
        // still full, keep trimming
      }
    }
    // Even 1 entry doesn't fit — clear everything
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return false;
  }
}

/**
 * Save an episode to continue watching history.
 * If the same anime already exists, update its episode + timestamp.
 * The list is sorted by most recently watched first.
 * If localStorage is full, oldest entries are removed to make room.
 */
export function saveToContinueWatching(entry: Omit<ContinueWatchingEntry, "watchedAt">) {
  const entries = readFromStorage();
  // Remove any existing entry for this anime (so we don't show duplicates)
  const filtered = entries.filter(e => e.animeId !== entry.animeId);
  // Prepend the new entry
  const newEntry: ContinueWatchingEntry = { ...entry, watchedAt: Date.now() };
  let updated = [newEntry, ...filtered].slice(0, MAX_ENTRIES);

  // Try to write — if it fails (quota), writeToStorage handles trimming
  const success = writeToStorage(updated);
  if (!success) {
    // Last resort: try with just the new entry alone
    writeToStorage([newEntry]);
  }

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
