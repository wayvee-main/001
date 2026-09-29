// Turns a guest's freeform taste tags (collected in src/app/taste.tsx) into a
// real ranking signal. No invented preferences — a tag only affects ranking
// by literally overlapping fields the catalog already carries (cuisine,
// searchTags, event vibe tags/categories, nightlife kind). Suggestions are
// pulled from that same real vocabulary, so every tag offered is guaranteed
// to match something in the catalog.

import { EVENTS, NIGHTLIFE_SPOTS, RESTAURANTS, isCurrentEvent, type CuratedCollection, type Restaurant, type ScoperEvent } from '@/lib/data';

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Real, catalog-sourced phrases a guest can tap to describe their taste —
 * restaurant cuisines/searchTags, current event vibe tags, nightlife kinds.
 * Ranked by how often each phrase actually occurs across the catalog, not
 * alphabetically — most of this vocabulary is one-off event descriptors
 * ("30th anniversary", "35mm"), and sorting those first surfaced noise
 * instead of recognizable categories. Requiring at least 2 occurrences and
 * ranking by count means the top of the list is always broad, real
 * categories (cuisines, neighborhoods, common vibes); alphabetical only
 * breaks ties. */
export function tasteVocabulary(): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  const add = (value: string | undefined | null) => {
    if (!value) return;
    const key = value.toLowerCase().trim();
    if (!key) return;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { label: value.trim(), count: 1 });
  };

  for (const r of Object.values(RESTAURANTS)) {
    add(r.cuisine);
    for (const tag of r.searchTags ?? []) add(tag);
  }
  for (const e of Object.values(EVENTS)) {
    if (!isCurrentEvent(e)) continue;
    for (const tag of e.vibeTags ?? []) add(tag);
  }
  for (const spot of NIGHTLIFE_SPOTS) add(spot.kind);

  return [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

/** Every token of the tag must appear in the (already-normalized) haystack —
 * "Live music" won't credit an entry that only mentions "music". Exported for
 * plan-engine.ts's exclusion penalty, which needs the identical word-boundary
 * match profileAffinity already uses — a looser substring test here would let
 * an exclusion and an affinity term disagree about whether a tag "matches". */
export function tagMatches(tag: string, normalizedHaystack: string): boolean {
  const tokens = normalize(tag).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => new RegExp(`(?:^|\\s)${token.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?:\\s|$)`).test(normalizedHaystack));
}

/** Something the guest did, aggregated into a ranking signal. `evidence` is the
 * line shown on screen 21 and in Profile → Your taste, so it has to describe
 * the real behaviour it came from ("Saved 3 Thai places"), never a summary of
 * the score. */
export interface ObservedSignal {
  tag: string;
  evidence: string;
  /** Weight at full strength, before decay. */
  weight: number;
  /** Date.now() of the most recent occurrence — decay is measured from here. */
  timestamp: number;
}

export interface TasteProfile {
  /** Tags the guest typed or tapped. */
  stated: string[];
  /** Signals derived from behaviour, weighted and decaying. */
  observed: ObservedSignal[];
  /** Tags the guest explicitly ruled out — the signal most apps ignore. */
  excluded: string[];
  /** Names of places visited recently, most recent first. Drives the repetition
   * penalty that keeps a stay varied (CLAUDE.md #4). */
  visitedRecently?: string[];
}

export const EMPTY_TASTE_PROFILE: TasteProfile = { stated: [], observed: [], excluded: [], visitedRecently: [] };

/** One line of a ranking explanation. Produced only by the rankers — never
 * written at a call site, because WhyThisTrustSurface tells the guest that
 * every line is a term the ranker actually used. */
export interface AffinityTerm {
  label: string;
  weight: number;
  reason: string;
  isPositive: boolean;
}

export interface DetailedAffinityResult {
  score: number;
  terms: AffinityTerm[];
}

/** Fraction of its original weight a signal retains once fully decayed. A
 * signal never reaches zero — "you liked this once, months ago" is weaker than
 * a fresh signal but is not nothing. */
export const SIGNAL_DECAY_FLOOR = 0.15;
/** Days over which a signal decays from full strength to the floor. */
export const SIGNAL_DECAY_DAYS = 90;

/** A signal's weight today. Decays linearly from full strength to
 * SIGNAL_DECAY_FLOOR of it over SIGNAL_DECAY_DAYS, then holds. The floor is
 * proportional, not absolute: a +2.0 signal bottoms out at +0.3, a +1.0 signal
 * at +0.15 — a weak old signal should not outrank a strong old one. */
export function calculateSignalWeight(signal: ObservedSignal, now = Date.now()): number {
  const ageDays = (now - signal.timestamp) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return signal.weight;
  const decayFactor = Math.max(SIGNAL_DECAY_FLOOR, 1 - (ageDays / SIGNAL_DECAY_DAYS) * (1 - SIGNAL_DECAY_FLOOR));
  return Number((signal.weight * decayFactor).toFixed(2));
}

/** Weights for the non-taste terms, so the numbers a guest sees on the trust
 * surface come from one table rather than from whichever screen rendered them. */
export const AFFINITY_WEIGHTS = {
  excluded: -5,
  stated: 1,
  repeat: -3,
  walkClose: 2,
  budgetMatch: 2,
  openNow: 1,
  closed: -6,
} as const;

/** Non-taste terms a ranker already computed — distance, budget fit, hours.
 * Passed in rather than recomputed so the trust surface and the ranking come
 * from exactly the same numbers. */
export interface AffinityContext {
  walkMinutes?: number | null;
  budgetMatches?: boolean | null;
  budgetLabel?: string;
  openLabel?: string | null;
  closedLabel?: string | null;
  /** The guest's stated walk budget, in minutes, from the arrival sequence.
   * When walkMinutes exceeds it, the candidate is demoted with a named reason —
   * sorted down, never hidden (CLAUDE.md #2: distance sorts, it doesn't filter). */
  walkBudgetMinutes?: number | null;
}

/** The full explanation for one candidate: stated, observed, excluded and
 * repetition terms from the profile, plus whatever distance/budget/hours terms
 * the caller already computed. Returns both the score the ranker should use and
 * the lines the trust surface should show — one calculation, not two. */
export function profileAffinity(
  rawHaystack: string,
  profile?: TasteProfile | null,
  context: AffinityContext = {},
  now = Date.now(),
): DetailedAffinityResult {
  const terms: AffinityTerm[] = [];
  let totalScore = 0;

  const push = (term: AffinityTerm) => {
    terms.push(term);
    totalScore += term.weight;
  };

  const haystack = rawHaystack ? normalize(rawHaystack) : '';

  if (haystack && profile) {
    for (const excluded of profile.excluded ?? []) {
      if (!tagMatches(excluded, haystack)) continue;
      push({
        label: excluded,
        weight: AFFINITY_WEIGHTS.excluded,
        reason: `You ruled out ${excluded}`,
        isPositive: false,
      });
    }

    for (const tag of profile.stated ?? []) {
      if (!tagMatches(tag, haystack)) continue;
      push({ label: tag, weight: AFFINITY_WEIGHTS.stated, reason: `You asked for ${tag}`, isPositive: true });
    }

    for (const signal of profile.observed ?? []) {
      if (!tagMatches(signal.tag, haystack)) continue;
      const weight = calculateSignalWeight(signal, now);
      push({
        label: signal.tag,
        weight,
        reason: signal.evidence,
        // Every observed signal used to be positive by construction (saves,
        // kept plans) — a post-visit "not for me" rating (taste-profile.ts)
        // is the first negative one, so the trust surface has to read the
        // sign rather than assume it.
        isPositive: weight >= 0,
      });
    }

    // Word-boundary matched, like every other term — a substring test here lets
    // a short venue name ("Mua") penalise unrelated entries that merely contain
    // those letters.
    for (const visited of profile.visitedRecently ?? []) {
      if (!tagMatches(visited, haystack)) continue;
      push({
        label: visited,
        weight: AFFINITY_WEIGHTS.repeat,
        reason: `You went to ${visited} recently`,
        isPositive: false,
      });
    }
  }

  if (context.walkMinutes != null && context.walkBudgetMinutes != null && context.walkMinutes > context.walkBudgetMinutes) {
    push({
      label: 'walk-budget',
      weight: AFFINITY_WEIGHTS.repeat,
      reason: `${context.walkMinutes} min walk — past your ${context.walkBudgetMinutes} min budget`,
      isPositive: false,
    });
  } else if (context.walkMinutes != null) {
    push({
      label: 'walk',
      weight: Number(Math.max(0, AFFINITY_WEIGHTS.walkClose - context.walkMinutes / 6).toFixed(2)),
      reason: `${context.walkMinutes} min walk from you`,
      isPositive: true,
    });
  }

  if (context.budgetMatches === true) {
    push({
      label: 'budget',
      weight: AFFINITY_WEIGHTS.budgetMatch,
      reason: `${context.budgetLabel ?? 'Price'} matches your budget`,
      isPositive: true,
    });
  }

  if (context.openLabel) {
    push({ label: 'hours', weight: AFFINITY_WEIGHTS.openNow, reason: context.openLabel, isPositive: true });
  } else if (context.closedLabel) {
    push({ label: 'hours', weight: AFFINITY_WEIGHTS.closed, reason: context.closedLabel, isPositive: false });
  }

  return { score: Number(totalScore.toFixed(2)), terms };
}

/** Count of taste tags that match a candidate's real fields — 0 when the
 * guest has no taste tags or none apply, so nothing changes for guests who
 * skip the taste screen entirely. */
export function affinityScore(tasteTags: string[], rawHaystack: string): number {
  if (!tasteTags.length || !rawHaystack) return 0;
  const haystack = normalize(rawHaystack);
  let score = 0;
  for (const tag of tasteTags) {
    if (tagMatches(tag, haystack)) score += 1;
  }
  return score;
}

export function restaurantHaystack(r: Restaurant): string {
  return [
    r.cuisine,
    ...(r.searchTags ?? []),
    r.openLate ? 'open late' : '',
    r.popularDishes?.map((d) => d.name).join(' '),
    // Real, per-restaurant verified operational text (hours/service/reservation
    // notes) — widens what a real fact can match against without inventing a
    // new "romantic"/"group-friendly" label the catalog doesn't actually have.
    ...(r.detailFacts?.map((f) => f.value) ?? []),
  ].filter(Boolean).join(' ');
}

export function eventHaystack(e: ScoperEvent): string {
  return [e.name, e.venue, e.lineup, ...(e.vibeTags ?? []), ...e.cats].filter(Boolean).join(' ');
}

/** A collection's real, curated copy plus its underlying restaurants'/events'
 * own cuisine and vibe tags — so "late night" or "jazz" taste tags can bump
 * a matching collection without inventing any signal the catalog doesn't have. */
export function collectionHaystack(collection: CuratedCollection): string {
  const itemText = collection.items
    .map((item) => {
      if (item.type === 'restaurant') {
        const restaurant = RESTAURANTS[item.id];
        return restaurant ? restaurantHaystack(restaurant) : '';
      }
      const event = EVENTS[item.id];
      return event ? eventHaystack(event) : '';
    })
    .join(' ');
  return [collection.title, collection.eyebrow, collection.subtitle, collection.description, itemText].join(' ');
}

/** Stable affinity sort — only reorders when the guest has taste tags, and
 * never changes relative order between equally-scored items (the existing
 * curation order is the tiebreak, not alphabetical or random). */
export function sortByAffinity<T>(items: T[], tasteTags: string[], haystackOf: (item: T) => string): T[] {
  if (!tasteTags.length) return items;
  return items
    .map((item, index) => ({ item, index, score: affinityScore(tasteTags, haystackOf(item)) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

