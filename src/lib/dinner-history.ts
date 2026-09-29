// Local record of restaurants this guest has explicitly saved, most-recent
// first — same device-local pattern as plan-history.ts. This is the only
// honest cross-session variety signal available to the Ask concierge: a
// restaurant visit is never tracked, so the one real thing to go on is what
// the guest chose to save. Recorded only on an explicit Save (never on a
// plan merely being shown), so it can't fabricate a "recently eaten" signal
// out of a plan the guest never acted on (CLAUDE.md: no invented data).
import { getStoredItem, setStoredItem } from '@/lib/storage';

const STORAGE_KEY = 'wayvee.dinnerHistory.v1';
const MAX_ENTRIES = 10;

export async function loadDinnerHistory(): Promise<string[]> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function recordDinnerHistory(restaurantId: string): Promise<void> {
  const existing = await loadDinnerHistory();
  const next = [restaurantId, ...existing.filter((id) => id !== restaurantId)].slice(0, MAX_ENTRIES);
  await setStoredItem(STORAGE_KEY, JSON.stringify(next));
}

export async function removeDinnerHistory(restaurantId: string): Promise<void> {
  const existing = await loadDinnerHistory();
  await setStoredItem(STORAGE_KEY, JSON.stringify(existing.filter((id) => id !== restaurantId)));
}
