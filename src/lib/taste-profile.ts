// Assembles the three-layer taste profile the app ranks with: what the guest
// told us, what they actually did, and what they ruled out.
//
// The observed layer is derived entirely from signals this app already records —
// dinner-history.ts (explicit saves) and plan-history.ts (plans that stuck).
// Nothing new is tracked to build it, and every signal carries the evidence line
// that produced it, so Profile → Your taste can show its work.

import { RESTAURANTS } from '@/lib/data';
import { loadDinnerHistory } from '@/lib/dinner-history';
import { loadPlanHistory, type PlanHistoryEntry } from '@/lib/plan-history';
import { deleteStoredItem, getStoredItem, setStoredItem } from '@/lib/storage';
import { EMPTY_TASTE_PROFILE, type ObservedSignal, type TasteProfile } from '@/lib/taste';
import { loadVisitFeedback, type VisitFeedbackEntry } from '@/lib/visit-feedback';

const EXCLUDED_KEY = 'wayvee.taste-excluded.v1';
const CONFIRM_LEARNING_KEY = 'wayvee.taste-confirm-learning.v1';

/** Weight a signal reaches at one occurrence, and the ceiling repeated
 * occurrences approach. Deliberately below the stated-tag weight at n=1: doing
 * something once is weaker evidence than saying so. */
const OBSERVED_BASE = 0.6;
const OBSERVED_CEILING = 2.2;

function observedWeight(occurrences: number): number {
  return Number(Math.min(OBSERVED_CEILING, OBSERVED_BASE * Math.sqrt(occurrences) + 0.4).toFixed(2));
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Cuisines the guest has saved, as weighted signals. Saves are the only honest
 * food signal on the device — a visit is never tracked (see dinner-history.ts).
 *
 * These carry `now` as their timestamp because dinner-history records order but
 * not date; they therefore don't decay. Recording a save timestamp is the
 * change that would make them decay honestly. */
function cuisineSignals(savedRestaurantIds: string[], now: number): ObservedSignal[] {
  const counts = new Map<string, number>();
  for (const id of savedRestaurantIds) {
    const cuisine = RESTAURANTS[id]?.cuisine;
    if (cuisine) counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
  }
  return [...counts.entries()].map(([cuisine, count]) => ({
    tag: cuisine,
    evidence: `Saved ${count} ${cuisine} ${plural(count, 'place', 'places')}`,
    weight: observedWeight(count),
    timestamp: now,
  }));
}

/** Venues and vibes from plans that stuck. plan-history entries are removed the
 * moment a guest un-plans something, so every entry here is a plan they kept —
 * and each carries its own plannedAt, so these decay properly. */
function planSignals(history: PlanHistoryEntry[]): ObservedSignal[] {
  const byVenue = new Map<string, { count: number; latest: number }>();
  const byVibe = new Map<string, { count: number; latest: number }>();

  const bump = (map: Map<string, { count: number; latest: number }>, key: string, at: number) => {
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.latest = Math.max(existing.latest, at);
    } else {
      map.set(key, { count: 1, latest: at });
    }
  };

  for (const entry of history) {
    const at = Date.parse(entry.plannedAt);
    if (!Number.isFinite(at)) continue;
    if (entry.venue) bump(byVenue, entry.venue, at);
    // Snapshotted on entry (see plan-history.ts) rather than looked up live —
    // the event itself is deleted from the catalog once it's past, so a live
    // EVENTS lookup here would silently lose this signal the moment it ages out.
    if (entry.kind === 'event') for (const vibe of entry.vibeTags ?? []) bump(byVibe, vibe, at);
  }

  return [
    ...[...byVenue.entries()].map(([venue, { count, latest }]) => ({
      tag: venue,
      evidence: `${count} ${plural(count, 'show', 'shows')} at ${venue}`,
      weight: observedWeight(count),
      timestamp: latest,
    })),
    ...[...byVibe.entries()].map(([vibe, { count, latest }]) => ({
      tag: vibe,
      evidence: `${count} ${plural(count, 'plan', 'plans')} tagged ${vibe}`,
      weight: observedWeight(count),
      timestamp: latest,
    })),
  ];
}

/** Weight an explicit post-visit rating carries — higher than a mere save
 * (OBSERVED_BASE at n=1) because "I was there and rated it" is stronger
 * evidence than "I bookmarked it once". 'not_for_me' is the same magnitude,
 * negative — a genuine penalty, not just the absence of a positive one. */
const RATING_WEIGHT = 1.6;

/** Venue and vibe signals from explicit post-visit ratings (screen 20) —
 * 'loved'/'not_for_me' only, since 'fine' and 'skipped' carry no real
 * preference to rank on. Joined against planHistory for the venue/vibeTags
 * snapshot, since visit-feedback.ts only stores the rating itself. */
function ratingSignals(feedback: VisitFeedbackEntry[], history: PlanHistoryEntry[]): ObservedSignal[] {
  const byKey = new Map(history.map((entry) => [`${entry.kind}:${entry.itemId}`, entry]));
  const signals: ObservedSignal[] = [];

  for (const item of feedback) {
    if (item.rating !== 'loved' && item.rating !== 'not_for_me') continue;
    const entry = byKey.get(`${item.kind}:${item.itemId}`);
    if (!entry) continue;
    const ratedAt = Date.parse(item.ratedAt);
    const timestamp = Number.isFinite(ratedAt) ? ratedAt : Date.now();
    const weight = item.rating === 'loved' ? RATING_WEIGHT : -RATING_WEIGHT;
    const evidence = item.rating === 'loved' ? `Rated "Loved it" — ${entry.name}` : `Rated "Not for me" — ${entry.name}`;

    if (entry.venue) signals.push({ tag: entry.venue, evidence, weight, timestamp });
    for (const vibe of entry.vibeTags ?? []) signals.push({ tag: vibe, evidence, weight, timestamp });
  }

  return signals;
}

export async function loadExcludedTags(): Promise<string[]> {
  const raw = await getStoredItem(EXCLUDED_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveExcludedTags(tags: string[]): Promise<void> {
  await setStoredItem(EXCLUDED_KEY, JSON.stringify(tags));
}

/** Default on: the design doc's recommendation, and the difference between a
 * profile a guest can debug and one that just happens to them. */
export async function loadConfirmBeforeLearning(): Promise<boolean> {
  return (await getStoredItem(CONFIRM_LEARNING_KEY)) !== 'off';
}

export async function saveConfirmBeforeLearning(enabled: boolean): Promise<void> {
  await setStoredItem(CONFIRM_LEARNING_KEY, enabled ? 'on' : 'off');
}

/** Clears everything the observed layer is built from, plus the exclusions.
 * Stated tags are the guest's own words and are left alone — "erase everything
 * we've learned" means what we inferred, not what they told us. */
export async function eraseLearnedTaste(): Promise<void> {
  await Promise.all([
    setStoredItem('wayvee.dinnerHistory.v1', JSON.stringify([])),
    setStoredItem('wayvee.planHistory.v1', JSON.stringify([])),
    setStoredItem('wayvee.visitFeedback.v1', JSON.stringify([])),
    deleteStoredItem(EXCLUDED_KEY),
  ]);
}

/** The full profile. `statedTags` come from the store (account-synced); the
 * observed and excluded layers are device-local. */
export async function buildTasteProfile(statedTags: string[], now = Date.now()): Promise<TasteProfile> {
  const [savedRestaurantIds, planHistory, excluded, visitFeedback] = await Promise.all([
    loadDinnerHistory(),
    loadPlanHistory(),
    loadExcludedTags(),
    loadVisitFeedback(),
  ]);

  return {
    ...EMPTY_TASTE_PROFILE,
    stated: statedTags,
    observed: [
      ...cuisineSignals(savedRestaurantIds, now),
      ...planSignals(planHistory),
      ...ratingSignals(visitFeedback, planHistory),
    ].sort((a, b) => b.weight - a.weight),
    excluded,
    // Saved restaurants double as the repetition signal: it's the same list the
    // plan engine already uses to keep a stay from repeating itself.
    visitedRecently: savedRestaurantIds.map((id) => RESTAURANTS[id]?.name).filter((name): name is string => Boolean(name)),
  };
}
