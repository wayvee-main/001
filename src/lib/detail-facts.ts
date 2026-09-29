// The detail screens' two derived slots: the one live line at the top, and the
// fact strip under it.
//
// Both used to be assembled inline on each screen, which is how the same fact
// ended up in three places at once — the open state was a green row AND a
// tile AND a week strip, the walk was a tile AND a meter. Deriving them here
// means each fact has exactly one producer, and the producers are testable
// without rendering a screen (there are no screen tests in this repo).
//
// The honesty rules from CLAUDE.md apply at this layer, not at the call sites:
// nothing below invents a value. An unknown open state produces no line, a
// missing walk produces no clause, and an absent field produces no fact.

import type { HubFact } from '@/components/fact-strip';
import { priceWord } from '@/lib/hub-copy';
import type { OpenState } from '@/lib/hours';

/** The green (or red) line at the top of a detail screen. `note` names where
 * the claim came from, because the whole point of the row is that the fact is
 * current and checkable. */
export interface LiveLine {
  tone: 'open' | 'danger';
  label: string;
  note: string;
}

const SOURCE_NOTE = 'Read from this kitchen’s published opening hours, synced daily.';

/** A detail screen's strip is one line and it does not scroll, so the facts
 * past the third do not get smaller — they get cut, and then every fact on the
 * line is cut. Four short facts already overflow 362 pt at `text-meta`, which
 * is how the row this replaced ended up rendering "10-cour…". Three is the
 * budget; the builders below are ordered so the first three are the ones worth
 * spending it on. */
const DETAIL_STRIP_MAX = 3;

/** Open state and walk time in one sentence.
 *
 * These were two blocks and four tiles between them. They belong together
 * because a guest asks them together — "can I still get in, and how far is
 * it" — and because neither is worth a block of its own once the other is
 * next to it.
 *
 * Returns null when the hours are unreadable: the catalog's own prose hours
 * keep doing the talking further down the page, and a row that says nothing
 * is worse than no row. A walk with no open state still earns a line, because
 * the distance is a real measured fact on its own. */
export function liveLineFor({
  openState,
  walkMinutes,
  walkBudgetMinutes,
  sourceNote = SOURCE_NOTE,
}: {
  openState: OpenState;
  walkMinutes?: number | null;
  walkBudgetMinutes?: number | null;
  sourceNote?: string;
}): LiveLine | null {
  const budget = walkBudgetMinutes && walkBudgetMinutes > 0 ? walkBudgetMinutes : null;
  const walkClause =
    walkMinutes == null
      ? null
      : budget == null
        ? `${walkMinutes} min walk`
        : walkMinutes > budget
          ? `${walkMinutes} min walk, past your ${budget} min budget`
          : `${walkMinutes} min walk, in budget`;

  const walkNote = walkMinutes == null ? '' : ' Walk measured from you.';

  if (openState.status === 'open') {
    const open = openState.closesAt ? `Open till ${openState.closesAt}` : 'Open · 24 hours';
    return {
      tone: 'open',
      label: [open, walkClause].filter(Boolean).join(' · '),
      note: `${sourceNote}${walkNote}`,
    };
  }

  if (openState.status === 'closed') {
    const closed = openState.opensAt ? `Closed · opens ${openState.opensAt}` : 'Closed now';
    return {
      tone: 'danger',
      label: [closed, walkClause].filter(Boolean).join(' · '),
      note: `${sourceNote}${walkNote}`,
    };
  }

  // Hours unknown. A measured walk is still a fact worth stating; a page with
  // neither gets no line at all.
  if (walkClause == null) return null;
  return { tone: 'open', label: walkClause, note: 'Walk measured from you.' };
}

/** The live line for an event: how long until it starts, and how far it is.
 *
 * The countdown is only a live fact inside `windowMinutes` of the start —
 * past that, "starts in 3 days" is a date, and the date line already said it.
 * Outside the window the walk still earns a line on its own. */
export function eventLiveLine({
  minutesToStart,
  windowMinutes,
  walkMinutes,
  walkBudgetMinutes,
  venue,
}: {
  minutesToStart: number | null;
  windowMinutes: number;
  walkMinutes?: number | null;
  walkBudgetMinutes?: number | null;
  venue: string;
}): LiveLine | null {
  const counting = minutesToStart != null && minutesToStart > 0 && minutesToStart <= windowMinutes;
  const clauses: string[] = [];
  if (counting) clauses.push(`Starts in ${shortDuration(minutesToStart!)}`);
  if (walkMinutes != null) {
    const budget = walkBudgetMinutes && walkBudgetMinutes > 0 ? walkBudgetMinutes : null;
    clauses.push(
      budget == null
        ? `${walkMinutes} min walk`
        : walkMinutes > budget
          ? `${walkMinutes} min walk, past your ${budget} min budget`
          : `${walkMinutes} min walk, in budget`,
    );
  }
  if (!clauses.length) return null;

  const notes = [
    counting ? `Counted from the start time on ${venue}’s official listing.` : null,
    walkMinutes != null ? 'Walk measured from you.' : null,
  ].filter(Boolean);
  return { tone: 'open', label: clauses.join(' · '), note: notes.join(' ') };
}

/** "1h 20m" / "45 min" / "2h" — a gap said the way a person would say it. */
function shortDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The strip under a restaurant's identity block.
 *
 * Deliberately not here: the open/closing time (the live line owns it) and the
 * walk (same). What is left is what nothing else on the page says. */
export function restaurantFacts({
  price,
  reservable,
  duration,
  distance,
}: {
  price?: string;
  reservable: boolean;
  /** Only when the catalog actually carries one, e.g. "allow 2.5–3 hours". */
  duration?: string | null;
  /** The catalog's own distance label, and only when no walk was measured —
   * pass null the moment liveLineFor() has a real walk to state, or the page
   * says the distance twice in two different units. */
  distance?: string | null;
}): HubFact[] {
  const facts: HubFact[] = [];
  if (price) {
    const word = priceWord(price);
    facts.push({ glyph: 'dollar', label: word ? `${price} · ${word}` : price, tone: 'accent' });
  }
  facts.push(
    reservable
      ? { glyph: 'check', label: 'Reserves online', tone: 'open' }
      : { glyph: 'pin', label: 'Walk in' },
  );
  if (duration) facts.push({ glyph: 'clock', label: duration });
  if (distance) facts.push({ glyph: 'route', label: distance });
  return facts.slice(0, DETAIL_STRIP_MAX);
}

/** The strip under an event's identity block. Doors only ever comes from the
 * listing's own date line — no doors published means no doors fact, never
 * show-time minus an assumed hour. */
export function eventFacts({
  doorsLabel,
  startLabel,
  priceLabel,
  travel,
}: {
  doorsLabel?: string | null;
  startLabel?: string;
  priceLabel?: string;
  travel?: string;
}): HubFact[] {
  const facts: HubFact[] = [];
  if (doorsLabel) facts.push({ glyph: 'clock', label: `Doors ${doorsLabel}` });
  if (startLabel) facts.push({ glyph: 'music', label: doorsLabel ? `On stage ${startLabel}` : `Starts ${startLabel}` });
  if (priceLabel) {
    facts.push({ glyph: 'ticket', label: priceLabel, tone: /free/i.test(priceLabel) ? 'open' : 'accent' });
  }
  if (travel) facts.push({ glyph: 'route', label: travel });
  return facts.slice(0, DETAIL_STRIP_MAX);
}

/** "allow 2.5–3 hours" out of a curated fact list, when one is carried.
 * Returns null rather than guessing a sitting length from the price tier. */
export function durationFrom(detailFacts: { label: string; value: string }[]): string | null {
  for (const fact of detailFacts) {
    const match = fact.value.match(/allow\s+([^·]+)/i);
    if (match) return match[1].trim().replace(/\.$/, '');
  }
  return null;
}
