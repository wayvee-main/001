// Deterministic fact lookup for 'answer_fact' asks ("is Yoshi's open
// Mondays?"). No model call is involved, and none is possible: ConciergeRequest
// has no venue field — the system prompt (supabase/functions/concierge/index.ts)
// deliberately never asks the model to name a place, so it can't hallucinate
// one (CLAUDE.md: no invented data). Only the client can answer this, because
// only the client holds the real catalog: it matches the guest's own words
// against real names it already carries, then reads the real hours off them
// (hours.ts). A match is real-catalog-or-nothing — never a guess at what the
// guest meant.
import { EVENTS, NIGHTLIFE_SPOTS, RESTAURANTS, type NightlifeSpot, type Restaurant } from '@/lib/data';
import { normalize } from '@/lib/taste';

export type FactSubjectKind = 'restaurant' | 'nightlife' | 'venue';

export interface FactSubject {
  kind: FactSubjectKind;
  id: string;
  name: string;
  address: string | null;
  sourceUrl: string | null;
}

interface Candidate extends FactSubject {
  tokens: number;
}

function tokenCount(name: string): number {
  return normalize(name).split(' ').filter(Boolean).length;
}

/** Every catalog entry with a name worth resolving a fact question against —
 * restaurants, nightlife spots, and event venues (Yoshi's, the Fox, the
 * Paramount…) sourced from the full curated event set, not just what's on
 * tonight, since "is Yoshi's open Mondays" doesn't require Yoshi's to have a
 * listing right now. Deduped by name so a venue hosting many events appears once. */
function buildCandidates(): Candidate[] {
  const candidates: Candidate[] = [];

  for (const restaurant of Object.values(RESTAURANTS) as Restaurant[]) {
    candidates.push({ kind: 'restaurant', id: restaurant.id, name: restaurant.name, address: restaurant.address || null, sourceUrl: restaurant.sourceUrl || null, tokens: tokenCount(restaurant.name) });
  }
  for (const spot of NIGHTLIFE_SPOTS as NightlifeSpot[]) {
    candidates.push({ kind: 'nightlife', id: spot.id, name: spot.name, address: spot.address || null, sourceUrl: spot.url || null, tokens: tokenCount(spot.name) });
  }

  const venuesSeen = new Set<string>();
  for (const event of Object.values(EVENTS)) {
    const key = normalize(event.venue);
    if (!key || venuesSeen.has(key)) continue;
    venuesSeen.add(key);
    candidates.push({ kind: 'venue', id: key, name: event.venue, address: event.addr || null, sourceUrl: event.sourceUrl || null, tokens: tokenCount(event.venue) });
  }

  return candidates;
}

/** Word-boundary containment, same discipline as taste.ts's tagMatches — a
 * short name like "Mua" must not credit an unrelated word that merely
 * contains those letters. */
function containsName(haystack: string, name: string): boolean {
  const needle = normalize(name);
  if (!needle) return false;
  return new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(haystack);
}

/** Resolves a guest's own sentence against the real catalog. When several
 * real names appear (rare, but "dinner near the Fox before Yoshi's" is
 * plausible), the longest — most specific — match wins, so a short
 * coincidental match never shadows the one the guest actually meant. Null
 * means genuinely unresolvable, and callers must decline honestly rather
 * than guess which place was meant. */
export function resolveFactSubject(rawText: string): FactSubject | null {
  const haystack = normalize(rawText);
  if (!haystack) return null;

  let best: Candidate | null = null;
  for (const candidate of buildCandidates()) {
    if (!containsName(haystack, candidate.name)) continue;
    if (!best || candidate.tokens > best.tokens) best = candidate;
  }
  if (!best) return null;
  const { tokens: _tokens, ...subject } = best;
  return subject;
}
