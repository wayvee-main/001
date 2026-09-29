// Locally-persisted "recently viewed from search" list — device-only (not
// synced to Supabase; it's a convenience trail, not account data). Stored
// through the same storage abstraction as everything else client-local.
import { getStoredItem, setStoredItem } from '@/lib/storage';

const STORAGE_KEY = 'wayvee.recentSearches.v1';
const MAX_ENTRIES = 8;

export interface RecentSearch {
  label: string;
  href: string;
}

function isRecentSearch(value: unknown): value is RecentSearch {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RecentSearch).label === 'string' &&
    typeof (value as RecentSearch).href === 'string'
  );
}

export async function loadRecentSearches(): Promise<RecentSearch[]> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch) : [];
  } catch {
    return [];
  }
}

/** Records a tapped result, most-recent first, deduped by href. Returns the
 * updated list so callers can update local state without a second read. */
export async function recordRecentSearch(entry: RecentSearch): Promise<RecentSearch[]> {
  const existing = await loadRecentSearches();
  const next = [entry, ...existing.filter((item) => item.href !== entry.href)].slice(0, MAX_ENTRIES);
  await setStoredItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await setStoredItem(STORAGE_KEY, JSON.stringify([]));
}
