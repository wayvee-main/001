// Locally-persisted list of what the guest has asked Vee — device-only (not
// synced to Supabase; it's a convenience trail, not account data). Modelled on
// recent-searches.ts and stored through the same abstraction.
//
// The composer opens cold every time without this: someone who asked "cheap
// thai near me" on Tuesday is the likeliest person to want something adjacent
// on Friday, and retyping it is the most avoidable cost in the flow.
import { getStoredItem, setStoredItem } from '@/lib/storage';

const STORAGE_KEY = 'wayvee.recentAsks.v1';
const MAX_ENTRIES = 6;
/** Long asks are kept whole in the store but would wrap the composer; the UI
 * truncates instead of the store, so reusing one replays exactly what was sent. */
const MAX_LENGTH = 240;

export interface RecentAsk {
  text: string;
  /** Epoch ms, so the list can show "Tue" without re-deriving order. */
  at: number;
}

function isRecentAsk(value: unknown): value is RecentAsk {
  const v = value as Partial<RecentAsk> | null;
  return Boolean(v && typeof v.text === 'string' && v.text.trim() && typeof v.at === 'number' && Number.isFinite(v.at));
}

export async function loadRecentAsks(): Promise<RecentAsk[]> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentAsk) : [];
  } catch {
    return [];
  }
}

/** Records a sent ask, most-recent first, deduped case-insensitively so asking
 * the same thing twice doesn't fill the list with itself. Returns the updated
 * list so callers can set state without a second read. */
export async function recordRecentAsk(text: string): Promise<RecentAsk[]> {
  const trimmed = text.trim().slice(0, MAX_LENGTH);
  if (!trimmed) return loadRecentAsks();
  const existing = await loadRecentAsks();
  const key = trimmed.toLowerCase();
  const next = [{ text: trimmed, at: Date.now() }, ...existing.filter((item) => item.text.toLowerCase() !== key)].slice(0, MAX_ENTRIES);
  await setStoredItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Short relative label for the list — "Today", a weekday inside the last week,
 * then a date. Deliberately coarse: the exact minute of a past ask is noise. */
export function recentAskDayLabel(at: number, now = Date.now()): string {
  const then = new Date(at);
  const today = new Date(now);
  const sameDay = then.toDateString() === today.toDateString();
  if (sameDay) return 'Today';
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(then);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(then);
}
