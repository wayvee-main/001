// "Right now" is live (CLAUDE.md #3). Everything here derives from the device
// clock — a real signal the app always has, with no key and no network — so Home
// can lead with what the hour actually calls for instead of one fixed layout
// that reads the same at 8 AM and 11 PM. Nothing here invents a fact about a
// place: it only decides what to show first and how to phrase the ask.

import { HOME_ACTION_LINKS, type HomeActionLink } from '@/lib/data';
import type { TripContext, WalkBudget } from '@/lib/arrival';

export type Daypart = 'morning' | 'midday' | 'afternoon' | 'evening' | 'lateNight';

/** Guest-local dayparts. Boundaries follow how the catalog itself is written —
 * cafés and brunch in the morning, happy hour mid-afternoon, calendars and
 * dinner in the evening, open-late spots after 11 PM. */
export function currentDaypart(now = new Date()): Daypart {
  const hour = now.getHours();
  if (hour < 5) return 'lateNight';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 23) return 'evening';
  return 'lateNight';
}

export function daypartGreeting(now = new Date()): string {
  switch (currentDaypart(now)) {
    case 'lateNight':
      return 'Good night';
    case 'morning':
      return 'Good morning';
    case 'midday':
    case 'afternoon':
      return 'Good afternoon';
    default:
      return 'Good evening';
  }
}

/** Search placeholder matched to the hour — the same box, asked the way a
 * concierge would ask it at that moment. */
export function daypartSearchPrompt(now = new Date()): string {
  switch (currentDaypart(now)) {
    case 'morning':
      return 'Coffee or breakfast nearby?';
    case 'midday':
      return 'Lunch nearby?';
    case 'afternoon':
      return 'Something to do before dinner?';
    case 'evening':
      return 'Anything nearby tonight?';
    case 'lateNight':
      return 'Still open near me?';
  }
}

/** True once the evening/late-night stretch starts — Home leads with the live
 * calendar then, and with food during the day. */
export function eventsLeadNow(now = new Date()): boolean {
  const daypart = currentDaypart(now);
  return daypart === 'evening' || daypart === 'lateNight';
}

/** Home's five quick-action launchers, led by the one the hour actually calls
 * for — coffee in the morning, happy hour mid-afternoon, reservations at dinner,
 * open-late after 11. Nothing is added or hidden (the row scrolls, so every
 * intent stays reachable); only the reading order changes, off the real clock. */
const ACTION_LEADERS: Record<Daypart, string[]> = {
  morning: ['Coffee near me', 'Fast delivery'],
  midday: ['Fast delivery', 'Coffee near me'],
  afternoon: ['Happy hours', 'Reserve tonight'],
  evening: ['Reserve tonight', 'Happy hours'],
  lateNight: ['Open late', 'Fast delivery'],
};

/** Fallback prompts for Home's "ask the AI planner" pills, by daypart — used
 * whenever the guest has no taste tags yet, and to fill any pill slots taste
 * tags don't cover. Phrasing is an intent fed into /create?q=…, not a claim
 * about any place, so it isn't subject to the no-invented-data rule. */
const DAYPART_CREATE_PROMPTS: Record<Daypart, { label: string; query: string }[]> = {
  morning: [
    { label: 'Coffee & Pastry', query: 'Coffee and a pastry nearby' },
    { label: 'Brunch Plans', query: 'Brunch with a friend' },
  ],
  midday: [
    { label: 'Quick Lunch', query: 'Quick lunch nearby' },
    { label: 'Coffee Break', query: 'Coffee and a short walk' },
  ],
  afternoon: [
    { label: 'Happy Hour', query: 'Happy hour drinks and small plates' },
    { label: 'Something Before Dinner', query: 'Something to do before dinner' },
  ],
  evening: [
    { label: 'Dinner & Live Music', query: 'Dinner, then live music' },
    { label: 'Upscale Date Night', query: 'Something upscale for a date night' },
  ],
  lateNight: [
    { label: 'Late Nightcaps', query: 'Late night cocktails and bites' },
    { label: 'Still Open', query: 'Something open late nearby' },
  ],
};

export type HomeSuggestion = {
  label: string;
  query: string;
  destination: 'food' | 'discover';
  glyph: string;
};

/** Lightweight discovery starters for Home's dual prompt/search entry. These
 * are deliberately separate from DAYPART_CREATE_PROMPTS: a suggestion chip is
 * a fast way into browsable results, not a request to build a whole plan. */
const DAYPART_HOME_SUGGESTIONS: Record<Daypart, HomeSuggestion[]> = {
  morning: [
    { label: 'Coffee', query: 'coffee', destination: 'food', glyph: 'coffee' },
    { label: 'Breakfast', query: 'breakfast', destination: 'food', glyph: 'sun' },
    { label: 'Brunch', query: 'brunch', destination: 'food', glyph: 'food' },
    { label: 'Bakeries', query: 'bakery', destination: 'food', glyph: 'spark' },
  ],
  midday: [
    { label: 'Lunch', query: 'lunch', destination: 'food', glyph: 'food' },
    { label: 'Coffee', query: 'coffee', destination: 'food', glyph: 'coffee' },
    { label: 'Quick bites', query: 'quick bites', destination: 'food', glyph: 'bolt' },
    { label: 'Patios', query: 'patio dining', destination: 'food', glyph: 'sun' },
  ],
  afternoon: [
    { label: 'Coffee', query: 'coffee', destination: 'food', glyph: 'coffee' },
    { label: 'Happy hour', query: 'happy hour', destination: 'food', glyph: 'drink' },
    { label: 'Dinner', query: 'dinner', destination: 'food', glyph: 'food' },
    { label: 'Live music', query: 'live music', destination: 'discover', glyph: 'music' },
  ],
  evening: [
    { label: 'Dinner', query: 'dinner', destination: 'food', glyph: 'food' },
    { label: 'Live music', query: 'live music', destination: 'discover', glyph: 'music' },
    { label: 'Cocktails', query: 'cocktails', destination: 'discover', glyph: 'drink' },
    { label: 'Late shows', query: 'late shows', destination: 'discover', glyph: 'ticket' },
  ],
  lateNight: [
    { label: 'Late bites', query: 'late-night food', destination: 'food', glyph: 'food' },
    { label: 'Open late', query: 'open late', destination: 'food', glyph: 'clock' },
    { label: 'Cocktails', query: 'cocktails', destination: 'discover', glyph: 'drink' },
    { label: 'Live music', query: 'live music', destination: 'discover', glyph: 'music' },
  ],
};

export function homeSuggestions(now = new Date()): HomeSuggestion[] {
  return DAYPART_HOME_SUGGESTIONS[currentDaypart(now)];
}

export type HomePromptContext = {
  now: Date;
  tripContext: TripContext | null;
  walkBudgetMinutes: WalkBudget;
  tasteTags: string[];
};

const HERO_TITLES: Record<Daypart, Record<TripContext | 'default', string>> = {
  morning: {
    visiting: 'Wake up with Oakland?',
    work: 'A spark before work?',
    live: 'What’s calling this morning?',
    default: 'What’s calling this morning?',
  },
  midday: {
    visiting: 'Where should lunch lead?',
    work: 'A lunch-break escape?',
    live: 'What’s calling nearby?',
    default: 'Where should lunch lead?',
  },
  afternoon: {
    visiting: 'Where next, Oakland?',
    work: 'A little after-work magic?',
    live: 'Where should the afternoon wander?',
    default: 'Where should the afternoon wander?',
  },
  evening: {
    visiting: 'Where will Oakland glow tonight?',
    work: 'Where to after work?',
    live: 'Where should tonight take you?',
    default: 'Where should tonight take you?',
  },
  lateNight: {
    visiting: 'What’s still glowing in Oakland?',
    work: 'One last little adventure?',
    live: 'What’s still humming nearby?',
    default: 'What’s still calling?',
  },
};

/** The hero changes with the guest's actual hour and stated trip context. Taste
 * remains in the chips, where even a long or niche tag can stay useful without
 * turning the headline into awkward generated copy. */
export function homeHeroPrompt(context: HomePromptContext): string {
  const titles = HERO_TITLES[currentDaypart(context.now)];
  return titles[context.tripContext ?? 'default'];
}

const CONTEXT_CREATE_PROMPTS: Record<TripContext, Record<Daypart, { label: string; query: string }>> = {
  visiting: {
    morning: { label: 'Oakland Morning', query: 'An essential Oakland morning stop' },
    midday: { label: 'Oakland Essential', query: 'An essential Oakland stop around lunch' },
    afternoon: { label: 'Oakland Afternoon', query: 'A memorable Oakland afternoon plan' },
    evening: { label: 'Oakland Tonight', query: 'An essential Oakland evening plan' },
    lateNight: { label: 'Open Late in Oakland', query: 'An essential Oakland spot open late' },
  },
  work: {
    morning: { label: 'Before Work', query: 'A quick stop before work' },
    midday: { label: 'Lunch-Break Pick', query: 'A good plan that fits a lunch break' },
    afternoon: { label: 'After Work', query: 'An easy plan after work' },
    evening: { label: 'Easy After Work', query: 'An easy evening plan after work' },
    lateNight: { label: 'One Last Stop', query: 'One easy stop before calling it a night' },
  },
  live: {
    morning: { label: 'Neighborhood Pick', query: 'A neighborhood favorite this morning' },
    midday: { label: 'Local Favorite', query: 'A local favorite around lunch' },
    afternoon: { label: 'Something New', query: 'Something new nearby this afternoon' },
    evening: { label: 'Local Favorite', query: 'A local favorite tonight' },
    lateNight: { label: 'Still Open Nearby', query: 'A local favorite still open nearby' },
  },
};

const TIME_QUERY_PHRASE: Record<Daypart, string> = {
  morning: 'this morning',
  midday: 'around lunch',
  afternoon: 'this afternoon',
  evening: 'tonight',
  lateNight: 'open late',
};

const TASTE_PROMPTS: Record<string, Record<Daypart, { label: string; query: string }>> = {
  restaurants: {
    morning: { label: 'Breakfast Nearby', query: 'Breakfast nearby this morning' },
    midday: { label: 'Quick Lunch', query: 'Quick lunch nearby' },
    afternoon: { label: 'Bites Before Dinner', query: 'A bite before dinner' },
    evening: { label: 'Dinner Nearby', query: 'Dinner nearby tonight' },
    lateNight: { label: 'Late-Night Bites', query: 'Late-night food still open' },
  },
  'live music': {
    morning: { label: 'Live Music Later', query: 'Live music later today' },
    midday: { label: 'Live Music Tonight', query: 'Live music tonight' },
    afternoon: { label: 'Live Music Tonight', query: 'Live music tonight' },
    evening: { label: 'Live Music Tonight', query: 'Live music tonight' },
    lateNight: { label: 'Live Music Now', query: 'Live music happening now' },
  },
  outdoor: {
    morning: { label: 'Morning Outdoors', query: 'Something outdoors this morning' },
    midday: { label: 'Fresh-Air Break', query: 'A quick outdoor break around lunch' },
    afternoon: { label: 'Outside Nearby', query: 'Something outdoors nearby this afternoon' },
    evening: { label: 'Sunset Outside', query: 'Something outdoors around sunset' },
    lateNight: { label: 'Outdoor Nearby', query: 'An outdoor place open late nearby' },
  },
  fitness: {
    morning: { label: 'Morning Workout', query: 'A workout this morning' },
    midday: { label: 'Quick Workout', query: 'A quick workout around lunch' },
    afternoon: { label: 'Move After Work', query: 'A fitness activity after work' },
    evening: { label: 'Evening Fitness', query: 'A fitness activity this evening' },
    lateNight: { label: 'Fitness Tomorrow', query: 'A fitness plan for tomorrow morning' },
  },
  nightlife: {
    morning: { label: 'Drinks Tonight', query: 'Drinks tonight' },
    midday: { label: 'Drinks Tonight', query: 'Drinks tonight' },
    afternoon: { label: 'Happy Hour', query: 'Happy hour drinks and small plates' },
    evening: { label: 'Drinks Tonight', query: 'Drinks nearby tonight' },
    lateNight: { label: 'Nightlife Now', query: 'Nightlife happening now' },
  },
  movies: {
    morning: { label: 'Movies Today', query: 'A movie playing today' },
    midday: { label: 'Afternoon Movie', query: 'A movie this afternoon' },
    afternoon: { label: 'Movie Nearby', query: 'A movie nearby this afternoon' },
    evening: { label: 'Movie Tonight', query: 'A movie tonight' },
    lateNight: { label: 'Late Show', query: 'A late movie showing nearby' },
  },
};

function tastePrompt(tag: string, daypart: Daypart): { label: string; query: string } {
  const curated = TASTE_PROMPTS[tag.trim().toLowerCase()]?.[daypart];
  if (curated) return curated;
  return {
    label: tag.length > 20 ? `${tag.slice(0, 19)}…` : tag,
    query: `${tag} ${TIME_QUERY_PHRASE[daypart]}`,
  };
}

function addWalkBudget(query: string, walkBudgetMinutes: WalkBudget): string {
  return walkBudgetMinutes ? `${query} within a ${walkBudgetMinutes} minute walk` : query;
}

/** Three prompt pills built from all the signals Home knows: taste first,
 * daypart defaults, trip context, and (inside the query rather than the label)
 * the guest's walk budget. The older two-argument signature remains supported
 * for Create's generic prompt starters. */
export function homeCreatePrompts(context: HomePromptContext): { label: string; query: string }[];
export function homeCreatePrompts(now: Date, tasteTags: string[]): { label: string; query: string }[];
export function homeCreatePrompts(
  contextOrNow: HomePromptContext | Date,
  legacyTasteTags: string[] = [],
): { label: string; query: string }[] {
  const context: HomePromptContext = contextOrNow instanceof Date
    ? { now: contextOrNow, tasteTags: legacyTasteTags, tripContext: null, walkBudgetMinutes: null }
    : contextOrNow;
  const daypart = currentDaypart(context.now);
  const fromTaste = context.tasteTags.slice(0, 2).map((tag) => tastePrompt(tag, daypart));
  const contextual = context.tripContext ? CONTEXT_CREATE_PROMPTS[context.tripContext][daypart] : null;
  // Reserve room for the trip-context suggestion before considering a second
  // taste tag. That keeps the row genuinely contextual instead of letting two
  // broad categories crowd out why the guest is in town.
  const candidates = [fromTaste[0], DAYPART_CREATE_PROMPTS[daypart][0], contextual, fromTaste[1], ...DAYPART_CREATE_PROMPTS[daypart]];
  const seen = new Set<string>();

  return candidates
    .filter((prompt): prompt is { label: string; query: string } => Boolean(prompt))
    .filter((prompt) => {
      const key = prompt.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((prompt) => ({ ...prompt, query: addWalkBudget(prompt.query, context.walkBudgetMinutes) }));
}

export function homeActionLinks(now = new Date()): HomeActionLink[] {
  const leaders = ACTION_LEADERS[currentDaypart(now)];
  const rank = (link: HomeActionLink) => {
    const lead = leaders.indexOf(link.label);
    return lead === -1 ? leaders.length + HOME_ACTION_LINKS.indexOf(link) : lead;
  };
  return [...HOME_ACTION_LINKS].sort((a, b) => rank(a) - rank(b));
}

/** "in 40 min" / "in 3 hr 10 min" / "starting now" for a real future timestamp.
 * Returns null for anything absent, unparseable, past, or more than a day out —
 * a countdown is only useful while it's actually counting down. */
export function countdownLabel(startsAt: string | undefined, now = new Date()): string | null {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;

  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
  if (minutes < -30 || minutes > 24 * 60) return null;
  if (minutes <= 0) return 'starting now';
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `in ${hours} hr ${rest} min` : `in ${hours} hr`;
}
