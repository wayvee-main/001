// Open-now, from real hours only.
//
// "Right now is live" (CLAUDE.md #3) means the app should be able to say
// whether a spot is open at the moment a guest is looking at it. The only
// machine-readable hours Wayvee has are OpenStreetMap `opening_hours` tags,
// carried verbatim into public.places.opening_hours by scripts/sync-places.ts.
//
// That syntax is far larger than what this file reads — it covers months,
// week numbers, sunrise/sunset offsets, nth-weekday-of-month, holiday
// calendars, and free-text comments. Rather than guess at the parts it can't
// model, this parser reads a conservative subset exactly and returns
// `unknown` for everything else. An honest "Hours not listed" beats a
// confident "Open now" that sends a guest to a locked door (CLAUDE.md: no
// invented data).
//
// What is read:
//   24/7
//   Mo-Fr 11:00-22:00
//   Mo-Fr 11:00-14:00,17:00-22:00
//   Mo,We,Fr 09:00-17:00; Sa 10:00-14:00; Su off
//   11:00-22:00                       (no weekday selector — every day)
//   Fr-Sa 18:00-02:00                 (crosses midnight)
//
// What is refused (-> unknown): months, week numbers, sunrise/sunset, date
// ranges, nth-weekday selectors, comments, variable/unknown markers.
//
// One documented exception: `PH`/`SH` (public/school holiday) rules are
// skipped rather than refused, because they'd otherwise disqualify a large
// share of otherwise-plain specs. The cost is that on a public holiday this
// can read a place as open when its PH rule says closed. Every surface that
// shows a computed state also shows the raw hours string it came from, so a
// guest can always see the source, and holidays are the one case where the
// app's own copy points at the official listing.

const DAY_TOKENS: Record<string, number> = {
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
};

/** Tokens whose meaning this parser cannot model. Their presence anywhere in a
 * spec makes the whole spec unreadable — a partial read of a conditional rule
 * is worse than no read at all. */
const UNREADABLE = /\[|\]|"|sunrise|sunset|dawn|dusk|easter|week\s|open\b|unknown|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;

export interface HoursInterval {
  /** Minutes from midnight, 0–1439. */
  start: number;
  /** Minutes from midnight; greater than 1440 when the interval crosses into
   * the next day (Fr 18:00-02:00 becomes 1080–1560). */
  end: number;
}

/** One parsed rule: which weekdays it covers, and the intervals open on them.
 * An empty interval list is an explicit "closed that day". */
export interface HoursRule {
  days: number[]; // 0 = Sunday, matching Date#getDay
  intervals: HoursInterval[];
}

function parseTime(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  // 24:00 is legal in this syntax and means end-of-day.
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  return hour * 60 + minute;
}

function parseDays(selector: string): number[] | null {
  const days = new Set<number>();
  for (const part of selector.split(',')) {
    const token = part.trim().toLowerCase();
    if (!token) return null;
    const range = token.match(/^([a-z]{2})-([a-z]{2})$/);
    if (range) {
      const from = DAY_TOKENS[range[1]];
      const to = DAY_TOKENS[range[2]];
      if (from === undefined || to === undefined) return null;
      // Wrapping ranges are legal and common (Fr-Mo = Fri, Sat, Sun, Mon).
      for (let i = 0; i < 7; i += 1) {
        const day = (from + i) % 7;
        days.add(day);
        if (day === to) break;
      }
      continue;
    }
    const single = DAY_TOKENS[token];
    if (single === undefined) return null;
    days.add(single);
  }
  return days.size ? [...days] : null;
}

function parseIntervals(value: string): HoursInterval[] | null {
  const intervals: HoursInterval[] = [];
  for (const part of value.split(',')) {
    const [rawStart, rawEnd, ...rest] = part.trim().split('-');
    if (!rawStart || !rawEnd || rest.length) return null;
    const start = parseTime(rawStart.trim());
    const end = parseTime(rawEnd.trim());
    if (start === null || end === null) return null;
    // end <= start means the interval runs past midnight (18:00-02:00).
    intervals.push({ start, end: end <= start ? end + 1440 : end });
  }
  return intervals.length ? intervals : null;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Parses the readable subset of OSM opening_hours. Returns null for anything
 * outside it — callers must treat null as "unknown", never as "closed". */
export function parseOpeningHours(spec: string | null | undefined): HoursRule[] | null {
  if (!spec) return null;
  const normalized = spec.trim().replace(/\s+/g, ' ');
  if (!normalized || UNREADABLE.test(normalized)) return null;
  if (normalized === '24/7') return [{ days: ALL_DAYS, intervals: [{ start: 0, end: 1440 }] }];

  const rules: HoursRule[] = [];
  for (const chunk of normalized.split(';')) {
    const rule = chunk.trim();
    if (!rule) continue;

    // Holiday rules are skipped, not refused — see the header note.
    if (/^(ph|sh)\b/i.test(rule)) continue;

    const match = rule.match(/^([A-Za-z,\- ]*?)\s*((?:\d{1,2}:\d{2}-\d{1,2}:\d{2})(?:,\d{1,2}:\d{2}-\d{1,2}:\d{2})*|off|closed)$/i);
    if (!match) return null;

    const selector = match[1].trim();
    const days = selector ? parseDays(selector) : ALL_DAYS;
    if (!days) return null;

    const value = match[2].toLowerCase();
    if (value === 'off' || value === 'closed') {
      rules.push({ days, intervals: [] });
      continue;
    }
    const intervals = parseIntervals(value);
    if (!intervals) return null;
    rules.push({ days, intervals });
  }

  return rules.length ? rules : null;
}

export type OpenState =
  /** Open now. `closesAt` is a label like '10 PM', or null for a 24-hour spot.
   * `closesInMinutes` is the same moment as a number, so callers can ask "is
   * this about to close" without parsing the label back into a time. Null
   * whenever closesAt is — a round-the-clock spot is never about to close. */
  | { status: 'open'; closesAt: string | null; closesInMinutes: number | null }
  /** Closed now. `opensAt` is a label like 'Tue 11 AM' when the next opening is
   * known, null when the parsed rules never reopen. */
  | { status: 'closed'; opensAt: string | null }
  /** No readable hours — say so, never assume either way. */
  | { status: 'unknown' };

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '22:00' -> '10 PM', '22:30' -> '10:30 PM'. Matches the catalog's own
 * phrasing ("till 9:30 PM Fri–Sat") rather than a 24-hour clock. */
export function clockLabel(minutesFromMidnight: number): string {
  const total = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function rulesForDay(rules: HoursRule[], day: number): HoursRule | null {
  // Later rules override earlier ones for the same day, which is how the
  // syntax's own "Mo-Su 09:00-17:00; Su off" override works.
  let found: HoursRule | null = null;
  for (const rule of rules) if (rule.days.includes(day)) found = rule;
  return found;
}

/** Whether a place is open at `now`, from its raw OSM hours string.
 * Everything is evaluated in the device's local time — the guest is standing
 * in the same timezone as the place. */
export function openStateFor(spec: string | null | undefined, now = new Date()): OpenState {
  const rules = parseOpeningHours(spec);
  if (!rules) return { status: 'unknown' };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();

  // Yesterday first: an interval that crossed midnight is still today's answer.
  for (const dayShift of [-1, 0]) {
    const day = (today + dayShift + 7) % 7;
    const rule = rulesForDay(rules, day);
    if (!rule) continue;
    for (const interval of rule.intervals) {
      const start = interval.start + dayShift * 1440;
      const end = interval.end + dayShift * 1440;
      if (nowMinutes >= start && nowMinutes < end) {
        // A full 24-hour block has no meaningful closing time to name.
        const roundTheClock = interval.end - interval.start >= 1440;
        return {
          status: 'open',
          closesAt: roundTheClock ? null : clockLabel(interval.end),
          closesInMinutes: roundTheClock ? null : end - nowMinutes,
        };
      }
    }
  }

  // Closed: find the next opening within a week.
  for (let dayShift = 0; dayShift < 8; dayShift += 1) {
    const day = (today + dayShift) % 7;
    const rule = rulesForDay(rules, day);
    if (!rule) continue;
    for (const interval of [...rule.intervals].sort((a, b) => a.start - b.start)) {
      const start = interval.start + dayShift * 1440;
      if (start <= nowMinutes) continue;
      const label = clockLabel(interval.start);
      return { status: 'closed', opensAt: dayShift === 0 ? label : `${WEEKDAY_LABELS[day]} ${label}` };
    }
  }

  return { status: 'closed', opensAt: null };
}

// Week order for display. The stored day numbers follow Date#getDay (0 = Sun),
// but a schedule reads as Monday-first, and compressing runs in that order is
// what turns [1,2,3,4,5] into "Mon–Fri" instead of five separate labels.
const DISPLAY_WEEK = [1, 2, 3, 4, 5, 6, 0];

function dayRangeLabel(days: number[]): string {
  const present = DISPLAY_WEEK.filter((day) => days.includes(day));
  const runs: number[][] = [];
  for (const day of present) {
    const last = runs[runs.length - 1];
    const previous = last?.[last.length - 1];
    if (last && previous !== undefined && DISPLAY_WEEK.indexOf(day) === DISPLAY_WEEK.indexOf(previous) + 1) last.push(day);
    else runs.push([day]);
  }
  return runs
    .map((run) => (run.length === 1 ? WEEKDAY_LABELS[run[0]] : `${WEEKDAY_LABELS[run[0]]}–${WEEKDAY_LABELS[run[run.length - 1]]}`))
    .join(', ');
}

/** The parsed hours rewritten in the catalog's own voice — 'Mon–Fri 11 AM–10 PM
 * · Sun closed'. Returns null when the spec isn't readable, in which case
 * callers should fall back to showing the source string verbatim rather than
 * dropping the information a guest could still act on. */
export function hoursSummary(spec: string | null | undefined): string | null {
  const rules = parseOpeningHours(spec);
  if (!rules) return null;
  if (rules.length === 1 && rules[0].days.length === 7 && rules[0].intervals.length === 1) {
    const [only] = rules[0].intervals;
    if (only.start === 0 && only.end >= 1440) return 'Open 24 hours';
  }
  return rules
    .map((rule) => {
      const days = dayRangeLabel(rule.days);
      if (!rule.intervals.length) return `${days} closed`;
      const windows = rule.intervals.map((interval) => `${clockLabel(interval.start)}–${clockLabel(interval.end)}`).join(', ');
      return `${days} ${windows}`;
    })
    .join(' · ');
}

/** The parsed week, Monday-first, for surfaces that draw the schedule instead
 * of writing it out. Same override semantics as openStateFor — a day with no
 * matching rule is omitted entirely (unknown), a day whose rule has no
 * intervals is present with an empty list (explicitly closed). Null when the
 * spec isn't readable at all, which callers must render as nothing. */
export function weekSchedule(spec: string | null | undefined): { day: number; intervals: HoursInterval[] }[] | null {
  const rules = parseOpeningHours(spec);
  if (!rules) return null;
  const days = DISPLAY_WEEK.map((day) => ({ day, rule: rulesForDay(rules, day) }))
    .filter((entry): entry is { day: number; rule: HoursRule } => entry.rule !== null)
    .map((entry) => ({ day: entry.day, intervals: entry.rule.intervals }));
  return days.length ? days : null;
}

/** 'Mon', 'Tue', … for a Date#getDay number. */
export function weekdayLabel(day: number): string {
  return WEEKDAY_LABELS[day] ?? '';
}

/** One short line for a card or fact row. Returns null when hours are unknown,
 * so callers can omit the row entirely rather than print "Unknown". */
export function openStateLabel(state: OpenState): string | null {
  switch (state.status) {
    case 'open':
      return state.closesAt ? `Open now · till ${state.closesAt}` : 'Open now · 24 hours';
    case 'closed':
      return state.opensAt ? `Closed · opens ${state.opensAt}` : 'Closed';
    default:
      return null;
  }
}
