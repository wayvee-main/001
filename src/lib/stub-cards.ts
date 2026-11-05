import { coversToday, type DiscoverDeal } from '@/lib/discover-deals';

/** What sits in a ticket's stub, left of the perforation.
 * - date: the calendar tile — only for something with a real date or a
 *   published weekly series. Never inferred.
 * - value: one published number that matters (a price, a happy-hour window,
 *   a stop on a route), set large with no calendar strip.
 * - glyph: a partner action with no number to show.
 * - thumb: everything else shows its own photo, or its icon. */
export type StubLead =
  | { kind: 'date'; top: string; value: string; under?: string }
  | { kind: 'value'; value: string; under?: string }
  | { kind: 'glyph'; glyph: string; under?: string }
  | { kind: 'thumb' };

/** Wayvee's catalog runs on Pacific time; a date tile reads the city's day. */
const CITY_TIME_ZONE = 'America/Los_Angeles';

/** Calendar tile for a dated event, or null when the date doesn't parse. */
export function dateLead(startsAt: string | undefined): StubLead | null {
  const time = Date.parse(startsAt || '');
  if (!Number.isFinite(time)) return null;
  const date = new Date(time);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: CITY_TIME_ZONE }).format(date);
  return { kind: 'date', top: part({ month: 'short' }).toUpperCase(), value: part({ day: 'numeric' }), under: part({ weekday: 'short' }).toUpperCase() };
}

/** A weekly series a venue publishes ("Blue Mondays"): the weekday, no date. */
export function weeklyLead(weekday: string): StubLead {
  return { kind: 'date', top: 'EVERY', value: weekday.slice(0, 3), under: 'WEEKLY' };
}

const TIME_RANGE = /(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)/i;

/** A deal's stub: its price, its happy-hour window, or the partner's glyph. */
export function dealLead(deal: DiscoverDeal, now = new Date()): StubLead {
  if (deal.badge === 'HH') {
    const [, afterAllDay] = deal.what.split(/all day/i);
    if (afterAllDay !== undefined && coversToday(afterAllDay, now)) return { kind: 'value', value: 'All', under: 'DAY' };
    const range = deal.what.match(TIME_RANGE);
    return range ? { kind: 'value', value: `${range[1]}–${range[2]}`, under: range[3].toUpperCase() } : { kind: 'value', value: 'HH' };
  }
  if (deal.badge === '%') return { kind: 'value', value: '%', under: 'OFF' };
  if (deal.badge) {
    const noun = deal.what.replace(deal.badge, '').trim().split(/[\s·,]+/)[0];
    return { kind: 'value', value: deal.badge, under: noun ? noun.toUpperCase() : undefined };
  }
  return { kind: 'glyph', glyph: deal.glyph || 'tag', under: deal.glyph === 'car' ? 'RIDE' : undefined };
}

/** A numbered stop on a route: 1 is where it starts, the last is the finish. */
export function stopLead(index: number, total: number): StubLead {
  return { kind: 'value', value: String(index + 1), under: index === 0 ? 'START' : index === total - 1 ? 'FINISH' : undefined };
}
