// Weather-triggered recovery (TODO.md Phase 3). If a guest has already added
// an outdoor event to their plans and the forecast for it turns rainy, this
// surfaces one real, ranked indoor alternative instead of leaving the rain-out
// for the guest to discover on their own. Reuses rankEvents/currentEventListings
// exactly as buildPlan does (adapter.ts) — never a second, parallel scoring
// system — and only ever suggests: nothing here replaces a plan on its own.
import { currentEventListings, isEventToday, type ScoperEvent } from '@/lib/data';
import { rankEvents } from '@/lib/plan-engine';
import { getStoredItem, setStoredItem } from '@/lib/storage';
import { weatherAt, type WeatherHour } from '@/lib/weather';

/** Forecast rain probability at or above which an outdoor plan is worth
 * flagging — the same cutoff rankEvents already treats as a real down-rank
 * (plan-engine.ts's rankEvents), so a recovery prompt and a freshly-built
 * plan's own scoring never disagree about what counts as "bad enough". */
const RECOVERY_PRECIP_THRESHOLD = 40;

export interface WeatherRecoveryAlert {
  eventId: string;
  eventName: string;
  precipProbability: number;
  alternative: ScoperEvent | null;
}

/** Checks every currently-planned event for a same-night outdoor/rain
 * mismatch. Pure and synchronous — callers own when to run it (typically once
 * per weather refresh) and how to dedupe repeats (see shouldNotifyRecovery).
 * `eventPool` defaults to the real, current catalog but is overridable —
 * same "tests run against literal fixtures instead of the live catalog"
 * pattern adapter.ts's ConciergeContext already establishes. */
export function checkWeatherRecovery(
  plannedEventIds: string[],
  weatherHours: WeatherHour[],
  now = new Date(),
  eventPool: ScoperEvent[] = currentEventListings(now),
): WeatherRecoveryAlert[] {
  const byId = new Map(eventPool.map((candidate) => [candidate.id, candidate]));
  const alerts: WeatherRecoveryAlert[] = [];

  for (const eventId of plannedEventIds) {
    const event = byId.get(eventId);
    if (!event || !event.startsAt || !event.cats.includes('Outdoor') || !isEventToday(event, now)) continue;

    const start = new Date(event.startsAt);
    if (Number.isNaN(start.getTime())) continue;

    const hour = weatherAt(start, weatherHours);
    const precip = hour?.precipProbability;
    if (precip == null || precip < RECOVERY_PRECIP_THRESHOLD) continue;

    const indoorPool = eventPool.filter(
      (candidate) => candidate.id !== event.id && isEventToday(candidate, now) && !candidate.cats.includes('Outdoor'),
    );
    const ranked = rankEvents(indoorPool, { tasteTags: [], vibes: [], weather: hour });
    alerts.push({ eventId: event.id, eventName: event.name, precipProbability: precip, alternative: ranked[0]?.item ?? null });
  }

  return alerts;
}

const NOTIFIED_STORAGE_KEY = 'wayvee.weatherRecovery.notified.v1';
const MAX_NOTIFIED_ENTRIES = 40;

function notifiedKey(eventId: string, now: Date): string {
  return `${eventId}:${now.toISOString().slice(0, 10)}`;
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Guards against re-notifying for the same event on the same day every time
 * the forecast refreshes — a guest should hear about a rained-out plan once,
 * not on every hourly weather sync. */
export async function shouldNotifyRecovery(eventId: string, now = new Date()): Promise<boolean> {
  const raw = await getStoredItem(NOTIFIED_STORAGE_KEY);
  const seen = raw ? parseStringArray(raw) : [];
  return !seen.includes(notifiedKey(eventId, now));
}

export async function markRecoveryNotified(eventId: string, now = new Date()): Promise<void> {
  const raw = await getStoredItem(NOTIFIED_STORAGE_KEY);
  const seen = raw ? parseStringArray(raw) : [];
  const key = notifiedKey(eventId, now);
  await setStoredItem(NOTIFIED_STORAGE_KEY, JSON.stringify([key, ...seen.filter((k) => k !== key)].slice(0, MAX_NOTIFIED_ENTRIES)));
}
