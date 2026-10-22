// Locally-persisted search queries and selected results — device-only (not
// synced to Supabase; it's a convenience trail, not account data). Stored
// through the same storage abstraction as everything else client-local.
import { getStoredItem, setStoredItem } from '@/lib/storage';

const STORAGE_KEY = 'wayvee.recentSearches.v1';
const MAX_ENTRIES = 8;
let writes:Promise<void>=Promise.resolve();
// SecureStore reads/writes are asynchronous. Keep a quick second search or
// Clear from racing an earlier write and restoring older history.
function queueWrite<T>(write:()=>Promise<T>):Promise<T> {
  const result=writes.then(write);
  writes=result.then(()=>undefined,()=>undefined);
  return result;
}

export interface RecentSearch {
  label: string;
  href: string;
  query?: string;
  city?: string;
}

function isRecentSearch(value: unknown): value is RecentSearch {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RecentSearch).label === 'string' &&
    typeof (value as RecentSearch).href === 'string' &&
    (value as RecentSearch).href.startsWith('/') &&
    ((value as RecentSearch).query === undefined || typeof (value as RecentSearch).query === 'string') &&
    ((value as RecentSearch).city === undefined || typeof (value as RecentSearch).city === 'string')
  );
}

export async function loadRecentSearches(): Promise<RecentSearch[]> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentSearch).slice(0,MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

/** Records a tapped result, most-recent first, deduped by href. Returns the
 * updated list so callers can update local state without a second read. */
export async function recordRecentSearch(entry: RecentSearch): Promise<RecentSearch[]> {
  return queueWrite(async()=>{
    const existing = await loadRecentSearches();
    const next = [entry, ...existing.filter(item=>{
      if(item.city!==entry.city)return true;
      return entry.query&&item.query
        ? item.query.trim().toLowerCase()!==entry.query.trim().toLowerCase()
        : item.href!==entry.href;
    })].slice(0, MAX_ENTRIES);
    await setStoredItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}

export async function clearRecentSearches(): Promise<void> {
  await queueWrite(()=>setStoredItem(STORAGE_KEY, JSON.stringify([])));
}
