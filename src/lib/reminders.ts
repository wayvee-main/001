import { EVENTS, eventDayGroupLabel, isCurrentEvent, type ScoperEvent } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';
import { daysUntilCheckout, isStayActive } from '@/lib/stay';
import type { WayveeStay } from '@/lib/user-data';
import type { WeatherHour } from '@/lib/weather';

const EVENT_REMINDER_LEAD_MINUTES = 90;
const STAY_REMINDER_HOUR_LOCAL = 10;
const POST_VISIT_HOUR_LOCAL = 9;
export const LEAVE_BY_BUFFER_MINUTES = 5;

/** Real fire time for a planned event's local notification — 90 minutes
 * before its actual start (from startsAt, not the display time string).
 * Returns null when the event has no startsAt or already started. */
export function planReminderFireTime(event: ScoperEvent, now = new Date()): Date | null {
  if (!event.startsAt) return null;
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const fireAt = new Date(start.getTime() - EVENT_REMINDER_LEAD_MINUTES * 60_000);
  return fireAt.getTime() > now.getTime() ? fireAt : null;
}

/** Real fire time for a stay's checkout-day reminder — 10 AM local time on
 * the checkout date. Returns null once that morning has already passed. */
export function stayCheckoutFireTime(stay: WayveeStay, now = new Date()): Date | null {
  const [year, month, day] = stay.checkOut.split('-').map(Number);
  if (!year || !month || !day) return null;
  const fireAt = new Date(year, month - 1, day, STAY_REMINDER_HOUR_LOCAL, 0, 0, 0);
  return fireAt.getTime() > now.getTime() ? fireAt : null;
}

export interface WayveeReminder {
  key: string;
  title: string;
  sub: string;
}

/** Derived, not stored — reminders always reflect current plans/stay, never go stale. */
export function activeReminders(plans: string[], stay: WayveeStay | null, now = new Date()): WayveeReminder[] {
  const reminders: WayveeReminder[] = [];

  for (const key of plans) {
    const [kind, eventId] = key.split(':');
    if (kind !== 'event') continue;
    const event = EVENTS[eventId];
    if (!event || !isCurrentEvent(event, now)) continue;
    const label = eventDayGroupLabel(event, now);
    if (label !== 'Tonight' && label !== 'Tomorrow') continue;
    reminders.push({
      key: `plan-${event.id}`,
      title: `${label}: ${event.name}`,
      sub: `${event.time} · ${event.venue}`,
    });
  }

  if (stay && isStayActive(stay, now)) {
    const daysLeft = daysUntilCheckout(stay, now);
    if (daysLeft === 0 || daysLeft === 1) {
      reminders.push({
        key: 'stay-checkout',
        title: daysLeft === 0 ? 'Checkout is today' : 'Checkout is tomorrow',
        sub: stay.propertyName,
      });
    }
  }

  return reminders;
}

/** A leave-by reminder timed off the real walk, not a fixed offset. `walkMinutes`
 * must come from an actual distance (geo.ts) and `condition` from the forecast
 * hour covering departure (weather.ts) — both are required rather than
 * defaulted, so a caller with neither gets no reminder instead of one that
 * cheerfully claims a nine minute walk it never measured.
 *
 * Returns null once arrival itself has passed — but stays non-null through
 * the whole [fireAt, arriveBy) window, past fireAt included, so a caller
 * building a live in-app list (not just a one-shot OS notification) can ask
 * "is this active right now" and get "Leave now" instead of losing the
 * reminder the instant it would have fired. */
export interface LeaveByReminder {
  fireAt: Date;
  arriveBy: Date;
  /** True once `now` has reached fireAt — the moment a scheduled OS
   * notification for this would already have fired. */
  isDue: boolean;
  title: string;
  body: string;
}

export function computeLeaveByReminder(
  arriveBy: Date,
  walkMinutes: number,
  condition: string,
  bufferMinutes = 5,
  now = new Date(),
): LeaveByReminder | null {
  if (!Number.isFinite(walkMinutes) || walkMinutes < 0) return null;
  if (arriveBy.getTime() <= now.getTime()) return null;
  const fireAt = new Date(arriveBy.getTime() - (walkMinutes + bufferMinutes) * 60_000);
  const isDue = fireAt.getTime() <= now.getTime();

  const leaveInMinutes = Math.max(0, Math.round((fireAt.getTime() - now.getTime()) / 60_000));
  return {
    fireAt,
    arriveBy,
    isDue,
    title: isDue ? 'Leave now' : `Leave in ${leaveInMinutes} ${leaveInMinutes === 1 ? 'minute' : 'minutes'}`,
    body: `It's a ${walkMinutes} min walk and it's ${condition}.`,
  };
}

/** Leave-by entries for the notifications list (screen 19) — only plans
 * currently inside their [fireAt, arriveBy) window, the same span an OS
 * notification for them would already have fired within. A plan whose venue
 * point or departure-hour forecast can't be resolved is skipped rather than
 * guessed, same rule computeLeaveByReminder itself follows.
 *
 * Dependency-injected (walkMinutesTo/weatherHourAt) rather than importing
 * geo.ts/weather.ts directly, so this stays a plain function over plain data
 * like the rest of this file — the caller (a component with location/weather
 * hooks already mounted) supplies the live bits. */
export function activeLeaveByReminders(
  plans: string[],
  venuePointOf: (event: ScoperEvent) => GeoPoint | null,
  walkMinutesTo: (point: GeoPoint) => number | null,
  weatherHourAt: (date: Date) => WeatherHour | null,
  now = new Date(),
): WayveeReminder[] {
  const reminders: WayveeReminder[] = [];

  for (const key of plans) {
    const [kind, eventId] = key.split(':');
    if (kind !== 'event') continue;
    const event = EVENTS[eventId];
    if (!event?.startsAt) continue;

    const venuePoint = venuePointOf(event);
    if (!venuePoint) continue;
    const walk = walkMinutesTo(venuePoint);
    if (walk == null) continue;

    const arriveBy = new Date(event.startsAt);
    const approxFireAt = new Date(arriveBy.getTime() - (walk + LEAVE_BY_BUFFER_MINUTES) * 60_000);
    const hour = weatherHourAt(approxFireAt);
    if (!hour) continue;

    const reminder = computeLeaveByReminder(arriveBy, walk, hour.shortForecast.toLowerCase(), LEAVE_BY_BUFFER_MINUTES, now);
    if (!reminder || !reminder.isDue) continue;

    reminders.push({ key: `leaveby-${event.id}`, title: reminder.title, sub: `${reminder.body} · ${event.venue}` });
  }

  return reminders;
}

/** Real fire time for the post-visit rating prompt (screen 20) — 9 AM local
 * the morning after the plan's real start. Returns null once that morning has
 * already passed, same "no reminder rather than a stale one" rule as the
 * other fire-time functions above. */
export function postVisitFireTime(startsAt: string, now = new Date()): Date | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const fireAt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, POST_VISIT_HOUR_LOCAL, 0, 0, 0);
  return fireAt.getTime() > now.getTime() ? fireAt : null;
}
