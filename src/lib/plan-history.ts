// Local snapshot log of plans the guest has made. Past events are DELETED
// from the catalog once they expire (see DATA.md) rather than archived, so
// this is the only honest way to show plan history — each entry is
// snapshotted from real data the guest actually saw at the moment they
// planned it, never reconstructed or guessed after the fact. Entries are
// removed the moment a guest un-plans something, so "past" only ever means
// "stayed planned until it happened", not "changed my mind about".
import { getStoredItem, setStoredItem } from '@/lib/storage';
import type { PlanKind } from '@/lib/user-data';

const STORAGE_KEY = 'wayvee.planHistory.v1';
const MAX_ENTRIES = 60;

export interface PlanHistoryEntry {
  kind: PlanKind;
  itemId: string;
  name: string;
  /** Only meaningful for kinds with a real venue/date/time — event and pick.
   * Other kinds (restaurant, venue, night, crawl) are undated, so these stay
   * unset rather than guessed (CLAUDE.md: no invented data). */
  venue?: string;
  date?: string;
  time?: string;
  startsAt?: string; // ISO, when known — used to order past plans chronologically
  /** Snapshotted at plan time, same reason as venue/date/time above — the
   * live event (and its vibeTags) is deleted from the catalog once it's
   * past, so this is the only copy still around for post-visit rating
   * (visit-feedback.ts) and the observed taste signal it feeds. */
  vibeTags?: string[];
  plannedAt: string; // ISO
}

function isPlanHistoryEntry(value: unknown): value is PlanHistoryEntry {
  const v = value as Partial<PlanHistoryEntry> | null;
  return (
    typeof v?.kind === 'string' &&
    typeof v?.itemId === 'string' &&
    typeof v?.name === 'string' &&
    typeof v?.plannedAt === 'string'
  );
}

export async function loadPlanHistory(): Promise<PlanHistoryEntry[]> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPlanHistoryEntry) : [];
  } catch {
    return [];
  }
}

export async function recordPlanHistory(entry: Omit<PlanHistoryEntry, 'plannedAt'>): Promise<void> {
  const existing = await loadPlanHistory();
  const next = [
    { ...entry, plannedAt: new Date().toISOString() },
    ...existing.filter((item) => !(item.kind === entry.kind && item.itemId === entry.itemId)),
  ].slice(0, MAX_ENTRIES);
  await setStoredItem(STORAGE_KEY, JSON.stringify(next));
}

export async function removePlanHistory(kind: PlanKind, itemId: string): Promise<void> {
  const existing = await loadPlanHistory();
  await setStoredItem(STORAGE_KEY, JSON.stringify(existing.filter((item) => !(item.kind === kind && item.itemId === itemId))));
}
