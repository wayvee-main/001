// Device-local record of how a guest rated a plan after attending it —
// screen 20's "How was X?" prompt. Explicit, opt-in signal: nothing here is
// inferred, only what the guest tapped. Feeds the observed layer in
// taste-profile.ts with a real evidence line ("Rated 'Loved it'"), and
// 'not_for_me' is a genuine negative signal — same honesty rule the
// excluded/repeat penalties in taste.ts already follow.
import { getStoredItem, setStoredItem } from '@/lib/storage';
import type { PlanHistoryEntry } from '@/lib/plan-history';
import type { PlanKind } from '@/lib/user-data';

const STORAGE_KEY = 'wayvee.visitFeedback.v1';
const OPT_OUT_KEY = 'wayvee.visitFeedback.optOut.v1';

/** How long after a plan's real start it stays eligible for the prompt —
 * long enough to catch a guest who doesn't open the app the next morning,
 * short enough that "how was it" still makes sense. */
const PENDING_WINDOW_DAYS = 4;

export type VisitRating = 'loved' | 'fine' | 'not_for_me' | 'skipped';

export interface VisitFeedbackEntry {
  kind: PlanKind;
  itemId: string;
  rating: VisitRating;
  ratedAt: string; // ISO
}

function isEntry(value: unknown): value is VisitFeedbackEntry {
  const v = value as Partial<VisitFeedbackEntry> | null;
  return Boolean(
    v && typeof v.kind === 'string' && typeof v.itemId === 'string' && typeof v.rating === 'string' && typeof v.ratedAt === 'string',
  );
}

export async function loadVisitFeedback(): Promise<VisitFeedbackEntry[]> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/** One rating per plan — a re-rating (shouldn't normally happen, since a
 * rated plan is never surfaced again) replaces rather than duplicates. */
export async function recordVisitFeedback(kind: PlanKind, itemId: string, rating: VisitRating): Promise<void> {
  const existing = await loadVisitFeedback();
  const next = [
    { kind, itemId, rating, ratedAt: new Date().toISOString() },
    ...existing.filter((entry) => !(entry.kind === kind && entry.itemId === itemId)),
  ];
  await setStoredItem(STORAGE_KEY, JSON.stringify(next));
}

/** "Don't ask about shows again" — a permanent, one-way opt-out, same spirit
 * as the observed-layer erase in taste-profile.ts. Scoped to events, matching
 * screen 20's own copy ("shows"), not every plan kind. */
export async function loadPostVisitOptOut(): Promise<boolean> {
  return (await getStoredItem(OPT_OUT_KEY)) === 'on';
}

export async function savePostVisitOptOut(enabled: boolean): Promise<void> {
  await setStoredItem(OPT_OUT_KEY, enabled ? 'on' : 'off');
}

/** The one plan (if any) the post-visit prompt should ask about right now —
 * the most recently concluded event that hasn't been rated (or skipped) and
 * still falls inside the pending window. Only ever one at a time, matching
 * screen 20's single-card design. */
export function findPendingPostVisit(
  planHistory: PlanHistoryEntry[],
  feedback: VisitFeedbackEntry[],
  now = new Date(),
): PlanHistoryEntry | null {
  const resolved = new Set(feedback.map((entry) => `${entry.kind}:${entry.itemId}`));
  const cutoff = now.getTime() - PENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const pending = planHistory.filter((entry) => {
    if (entry.kind !== 'event' || !entry.startsAt) return false;
    if (resolved.has(`${entry.kind}:${entry.itemId}`)) return false;
    const start = Date.parse(entry.startsAt);
    return Number.isFinite(start) && start < now.getTime() && start > cutoff;
  });

  return pending.length
    ? pending.reduce((latest, entry) => (Date.parse(entry.startsAt as string) > Date.parse(latest.startsAt as string) ? entry : latest))
    : null;
}
