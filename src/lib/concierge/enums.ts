// The fixed vocabularies the concierge is allowed to return, and the single
// source of truth for them. Deliberately has ZERO imports: this module is
// loaded by the guardrail (request.ts), by the app (user-data.ts re-exports
// it), and by plain Node in scripts/eval-concierge.ts. Anything imported here
// would drag the React Native runtime into the eval and the tests — which is
// exactly what used to make `npm run eval:concierge` impossible to run.
//
// supabase/functions/concierge/index.ts restates these same values in its JSON
// schema, because a Deno Edge Function can't import from src/. That copy is
// held honest by the drift test in src/lib/__tests__/concierge-schema.test.ts,
// which reads the function source and compares it against this file.

export const PACE_OPTIONS = ['Relaxed', 'Packed'] as const;
export type PacePreference = (typeof PACE_OPTIONS)[number];

export const BUDGET_OPTIONS = ['$', '$$', '$$$'] as const;
export type BudgetPreference = (typeof BUDGET_OPTIONS)[number];

/** The model's own self-rated certainty about its parse. */
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type ConciergeConfidence = (typeof CONFIDENCE_LEVELS)[number];

/** What shape of answer the sentence is asking for. A wrong value here sends a
 * guest to the wrong page, which is far more visible than a slightly-off budget
 * guess — so request.ts fails the whole parse on an unrecognised one rather
 * than falling back to a default. */
export const INTENT_OPTIONS = [
  'plan_evening',
  'find_place',
  'find_event',
  'find_activity',
  'answer_fact',
  'refine',
  'unknown',
] as const;
export type ConciergeIntentKind = (typeof INTENT_OPTIONS)[number];

/** Requests that predate the intent field — the deployed Edge Function returned
 * no `intent` before this — are read as the only behaviour that existed then. */
export const DEFAULT_INTENT: ConciergeIntentKind = 'plan_evening';

/** Catalog areas a request can be scoped to. Only areas the app can actually
 * resolve appear here: 'outdoors' and 'fitness' are deliberately absent until
 * there is a catalog behind them, so the model can never scope a request to
 * something with no results. */
export const DOMAIN_OPTIONS = ['food', 'events', 'music', 'film', 'drinks'] as const;
export type ConciergeDomain = (typeof DOMAIN_OPTIONS)[number];

/** The kind of evening the guest described, inferred from phrasing like
 * "anniversary dinner" (date_night) or "with the guys" (group). Scoring reads
 * real, already-verified catalog facts (reserveUrl, detailFacts text) against
 * this — it never adds a fabricated "romantic"/"group-friendly" label. */
export const OCCASION_OPTIONS = ['date_night', 'casual', 'group', 'solo'] as const;
export type Occasion = (typeof OCCASION_OPTIONS)[number];
