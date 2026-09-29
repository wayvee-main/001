// Device-local persistence for tonight's askPlan (TODO.md's open "decide
// retention policy for rawText" question) — resolved here by never storing
// rawText at all: everything else in ConciergeRequest is already enum-only
// (concierge/types.ts), so only rawText carries free-text guest input.
// Mirrors dinner-history.ts's read/write shape. Scoped to "tonight" only —
// a plan from a previous calendar day is stale, not resumable (same 5 AM
// day-boundary concept resolveAskNow/daypart.ts already use elsewhere).
import { EVENTS, NIGHTLIFE_SPOTS, RESTAURANTS } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';
import { orderedLegs, planStopOrder, type StopKind } from '@/lib/plan-engine';
import { coordsForCurated } from '@/lib/places';
import { getStoredItem, setStoredItem, deleteStoredItem } from '@/lib/storage';
import { todayIso } from '@/lib/stay';
import type { AskPlanSource, ConciergePlan, ConciergeRequest } from './types';

const STORAGE_KEY = 'wayvee.askPlan.v1';

interface StoredAskPlan {
  dateIso: string;
  request: ConciergeRequest;
  restaurantId: string | null;
  eventId: string | null;
  nightlifeSpotId: string | null;
  reasons: { restaurant: string[]; event: string[]; nightlife: string[] };
  confidence: ConciergePlan['confidence'];
  notes: string[];
  relaxed: ConciergePlan['relaxed'];
  /** Absent on blobs written before the field existed — read as "unknown",
   * which /plan treats as "do not claim the concierge". */
  source?: AskPlanSource;
}

function isStoredAskPlan(value: unknown): value is StoredAskPlan {
  const v = value as Partial<StoredAskPlan> | null;
  return Boolean(v && typeof v.dateIso === 'string' && typeof v.request === 'object' && v.request !== null && typeof v.confidence === 'string');
}

export async function saveAskPlan(plan: ConciergePlan, request: ConciergeRequest, source: AskPlanSource): Promise<void> {
  const stored: StoredAskPlan = {
    dateIso: todayIso(),
    request: { ...request, rawText: '' },
    restaurantId: plan.solved.restaurant?.id ?? null,
    eventId: plan.solved.event?.id ?? null,
    nightlifeSpotId: plan.solved.nightlifeSpot?.id ?? null,
    reasons: plan.solved.reasons,
    confidence: plan.confidence,
    notes: plan.notes,
    relaxed: plan.relaxed,
    source,
  };
  await setStoredItem(STORAGE_KEY, JSON.stringify(stored));
}

export async function clearAskPlan(): Promise<void> {
  await deleteStoredItem(STORAGE_KEY);
}

/** Re-resolves ids against the live catalog rather than trusting cached
 * objects — a listing that rotated out between save and load must never
 * render a dangling stop (CLAUDE.md #6). Any missing referenced id, or a
 * plan saved on a prior calendar day, discards the whole stored plan. */
export async function loadAskPlan(): Promise<{ plan: ConciergePlan; request: ConciergeRequest; source: AskPlanSource | null } | null> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return null;

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isStoredAskPlan(stored)) return null;
  if (stored.dateIso !== todayIso()) {
    await clearAskPlan();
    return null;
  }

  const restaurant = stored.restaurantId ? (RESTAURANTS[stored.restaurantId] ?? null) : null;
  if (stored.restaurantId && !restaurant) {
    await clearAskPlan();
    return null;
  }
  const event = stored.eventId ? (EVENTS[stored.eventId] ?? null) : null;
  if (stored.eventId && !event) {
    await clearAskPlan();
    return null;
  }
  const nightlifeSpot = stored.nightlifeSpotId ? (NIGHTLIFE_SPOTS.find((spot) => spot.id === stored.nightlifeSpotId) ?? null) : null;
  if (stored.nightlifeSpotId && !nightlifeSpot) {
    await clearAskPlan();
    return null;
  }

  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const { order: stopOrder, dinnerTimeLabel } = planStopOrder(event, restaurant, nightlifeSpot, now);
  const pointForStop = (kind: StopKind): GeoPoint | null => {
    if (kind === 'event') return event ? coordsForCurated({ name: event.venue }) : null;
    if (kind === 'dinner') return restaurant ? coordsForCurated(restaurant) : null;
    return nightlifeSpot ? coordsForCurated(nightlifeSpot) : null;
  };
  const stopLegs = orderedLegs(stopOrder, pointForStop);

  const plan: ConciergePlan = {
    solved: { restaurant, event, nightlifeSpot, reasons: stored.reasons },
    stopOrder,
    stopLegs,
    dinnerTimeLabel,
    confidence: stored.confidence,
    notes: stored.notes,
    relaxed: stored.relaxed,
  };

  return { plan, request: stored.request, source: stored.source ?? null };
}
