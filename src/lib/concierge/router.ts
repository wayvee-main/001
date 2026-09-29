// Maps a validated intent to the route that renders that shape of answer.
// Extracted from the screens so there is one table to read when asking "where
// does this question land", and so a new intent can't quietly fall through to
// whichever branch happens to be last.

import type { ConciergeRequest } from './types';

export type AnswerShape = 'places' | 'events' | 'fact' | 'declined';

/** Which of /answer's renderers an intent uses. `plan_evening` is absent on
 * purpose — it routes to /plan, the itinerary renderer, not here. */
export function answerShapeFor(intent: ConciergeRequest['intent']): AnswerShape {
  switch (intent) {
    case 'find_place':
      return 'places';
    case 'find_event':
      return 'events';
    // 'fact' resolves deterministically against the real catalog
    // (concierge/fact.ts) — no model involved, so no hallucination risk.
    // answer.tsx renders its own "couldn't tell which place" copy inline when
    // the guest's sentence doesn't contain a real catalog name to resolve —
    // that's a resolution failure, not a declined intent, so it never reaches
    // DECLINE_REASONS below.
    case 'answer_fact':
      return 'fact';
    // find_activity has no catalog behind it yet, and refine needs a plan
    // already on screen. Both decline rather than borrowing a renderer that
    // would answer a different question.
    case 'find_activity':
    case 'refine':
    case 'unknown':
    default:
      return 'declined';
  }
}

/** The full route for a request, including /plan for evening planning. */
export function routeForRequest(request: ConciergeRequest): string {
  if (request.intent === 'plan_evening') return '/plan';
  const params = new URLSearchParams({ intent: request.intent, q: request.rawText });
  if (request.exclusions.length) params.set('not', request.exclusions.join(','));
  if (request.budget) params.set('budget', request.budget);
  return `/answer?${params.toString()}`;
}

/** Why a declined intent declined — shown verbatim, so a guest is never left
 * guessing whether the app misunderstood them or simply can't do it yet. */
export const DECLINE_REASONS: Record<string, string> = {
  find_activity: 'Oakland trails, parks and studios aren’t in the catalog yet, so there is nothing real to rank.',
  refine: 'Refining works on a plan that’s already open. Build one first, then ask for cheaper or closer.',
  unknown: 'Rather than guess and hand you something built on nothing, here’s what’s actually on.',
};
