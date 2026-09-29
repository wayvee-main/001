// Shapes for the Ask concierge (docs/build-book.md Part 3). ConciergeRequest is
// the model's only output — every field is one of a small, known set, never
// freeform text, so nothing downstream can look up a value that doesn't exist
// in the real catalog (CLAUDE.md: no invented data).
import type { SolvedNight, StopKind } from '@/lib/plan-engine';
import type {
  BudgetPreference,
  ConciergeConfidence,
  ConciergeDomain,
  ConciergeIntentKind,
  Occasion,
  PacePreference,
} from './enums';

export type { ConciergeDomain, ConciergeIntentKind };

export interface ConciergeRequest {
  /** What shape of answer was asked for — routes to a resolver in
   * concierge/router.ts. Defaults to 'plan_evening' only when the field is
   * absent entirely; an unrecognised value fails the parse. */
  intent: ConciergeIntentKind;
  rawText: string;
  /** Catalog areas to scope to. Members of DOMAIN_OPTIONS only. */
  domains: ConciergeDomain[];
  /** Things to rank *down*, never to hide — members of tasteVocabulary(), same
   * guardrail as moodTags, so an exclusion the ranker can't match never gets
   * reported to the guest as applied. */
  exclusions: string[];
  /** Dietary restrictions/allergies stated as non-negotiable ("allergic to
   * shellfish", "vegan") — same tasteVocabulary() guardrail as exclusions, but
   * rankRestaurants drops a match entirely instead of scoring it down. Food
   * safety is the one case where CLAUDE.md's "never drop, only demote" rule
   * doesn't apply: a downranked allergen is still a plan that can hurt someone. */
  hardExclusions: string[];
  /** The kind of evening this is, when the guest's sentence says so — adjusts
   * which restaurants/events score well (a reservable spot for date_night, a
   * "group dining" one for group) without ever inventing a catalog field for
   * it; scoring reads real, already-verified restaurant facts instead. */
  occasion: Occasion | null;
  pace: PacePreference | null;
  budget: BudgetPreference | null;
  /** Must be members of tasteVocabulary() — unknown tags are dropped by parseConciergeRequest. */
  moodTags: string[];
  timeWindow: { startsBy: string | null; backBy: string | null };
  wantsNightlife: boolean;
  /** The model's own self-rated certainty. Never gates a plan's *content* — but
   * a 'low' rating with no usable signal at all means there was nothing to plan
   * from, which routes to browsing instead (see conciergeDeclined). */
  confidence: ConciergeConfidence;
}

/** strong = a real, unconstrained match. narrowed = shown with an honest caveat
 * (stale data, a relaxed constraint). fallback = solveNight() fell through to
 * its always-returns-something behavior. Never hidden from the guest. */
export type PlanConfidence = 'strong' | 'narrowed' | 'fallback';

export type RelaxedConstraint = 'backBy' | 'walkBudget' | 'moodTags' | 'hardExclusions';

/** Which of the three things actually built the plan on screen.
 *
 * askRequest cannot answer this: when the model call fails, submitAsk builds a
 * plan_evening request locally and carries on, so a request object exists
 * either way. /plan puts the concierge's name on its header, and that name has
 * to be earned. 'shape' is a ready-made tile, which never asks anything. */
export type AskPlanSource = 'concierge' | 'local' | 'shape';

export interface ConciergePlan {
  solved: SolvedNight;
  stopOrder: StopKind[];
  stopLegs: (string | null)[];
  dinnerTimeLabel: string;
  confidence: PlanConfidence;
  /** Plain, computed statements only — e.g. "Event listings last checked 3 days ago". */
  notes: string[];
  relaxed: RelaxedConstraint[];
}
