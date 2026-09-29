// The guardrail: turns whatever the model returned into a ConciergeRequest or
// nothing. Every field is checked against a fixed, known set — an invented
// mood tag or an out-of-range time is dropped or fails the whole parse, never
// passed through. This is what makes a hallucinated value structurally
// impossible downstream: everything after this looks the value up in the
// real catalog, and a made-up one simply won't be found.
import {
  BUDGET_OPTIONS,
  DEFAULT_INTENT,
  DOMAIN_OPTIONS,
  INTENT_OPTIONS,
  OCCASION_OPTIONS,
  PACE_OPTIONS,
  type BudgetPreference,
  type ConciergeDomain,
  type ConciergeIntentKind,
  type Occasion,
  type PacePreference,
} from './enums';
import type { ConciergeRequest } from './types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_RAW_TEXT_LENGTH = 500;
const MAX_MOOD_TAGS = 8;

function isPace(value: unknown): value is PacePreference {
  return typeof value === 'string' && (PACE_OPTIONS as readonly string[]).includes(value);
}

function isBudget(value: unknown): value is BudgetPreference {
  return typeof value === 'string' && (BUDGET_OPTIONS as readonly string[]).includes(value);
}

function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

function isOccasion(value: unknown): value is Occasion {
  return typeof value === 'string' && (OCCASION_OPTIONS as readonly string[]).includes(value);
}

/** Filters to members of the real taste vocabulary only — an unknown tag is
 * dropped, not kept, so it can never fabricate a signal the catalog doesn't have.
 * Output uses the vocabulary's own casing, not the model's: adapter.ts's
 * KNOWN_VIBES check ('Foodie', 'Outdoors', 'Nightlife') is case-sensitive, so a
 * model that returns "foodie" instead of "Foodie" would otherwise pass this
 * guardrail but silently fail to register as a vibe downstream — a real,
 * undetectable-by-eye loss of signal, not just a cosmetic mismatch. */
function parseMoodTags(value: unknown, vocabulary: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const canonicalByLower = new Map(vocabulary.map((tag) => [tag.toLowerCase(), tag]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const key = entry.toLowerCase().trim();
    const canonical = key ? canonicalByLower.get(key) : undefined;
    if (!canonical || seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
    if (out.length >= MAX_MOOD_TAGS) break;
  }
  return out;
}

function isIntent(value: unknown): value is ConciergeIntentKind {
  return typeof value === 'string' && (INTENT_OPTIONS as readonly string[]).includes(value);
}

/** Same canonicalising filter as parseMoodTags, over the domain enum. An
 * unrecognised domain is dropped rather than failing the parse: a request
 * scoped to nothing still resolves, it just isn't narrowed. */
function parseDomains(value: unknown): ConciergeDomain[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ConciergeDomain[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const key = entry.toLowerCase().trim();
    if (seen.has(key) || !(DOMAIN_OPTIONS as readonly string[]).includes(key)) continue;
    seen.add(key);
    out.push(key as ConciergeDomain);
  }
  return out;
}

/** Returns null on any structural failure — a guest sees the browse path
 * rather than a plan built from a request that didn't actually validate. */
export function parseConciergeRequest(value: unknown, vocabulary: string[]): ConciergeRequest | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;

  if (typeof v.rawText !== 'string' || v.rawText.length === 0 || v.rawText.length > MAX_RAW_TEXT_LENGTH) return null;

  const pace = isPace(v.pace) ? v.pace : null;
  if (v.pace != null && pace === null) return null;

  const budget = isBudget(v.budget) ? v.budget : null;
  if (v.budget != null && budget === null) return null;

  if (typeof v.wantsNightlife !== 'boolean') return null;
  if (v.confidence !== 'high' && v.confidence !== 'medium' && v.confidence !== 'low') return null;

  const rawWindow = v.timeWindow as Record<string, unknown> | undefined;
  const startsBy = rawWindow && rawWindow.startsBy != null ? (isTimeString(rawWindow.startsBy) ? rawWindow.startsBy : undefined) : null;
  const backBy = rawWindow && rawWindow.backBy != null ? (isTimeString(rawWindow.backBy) ? rawWindow.backBy : undefined) : null;
  if (startsBy === undefined || backBy === undefined) return null;

  // Absent means "a response from before this field existed" — read as the only
  // behaviour that existed then. Present but unrecognised means the model
  // invented a value, and a wrong intent routes the guest to the wrong page:
  // that fails the whole parse, exactly like an invalid pace or budget above.
  if (v.intent != null && !isIntent(v.intent)) return null;
  const intent = isIntent(v.intent) ? v.intent : DEFAULT_INTENT;

  // Absent means "a response from before this field existed" — same read as
  // intent above. Present but unrecognised fails the parse rather than
  // silently dropping it: an occasion the model invented shouldn't quietly
  // steer scoring toward a mode the guest never asked for.
  if (v.occasion != null && !isOccasion(v.occasion)) return null;
  const occasion = isOccasion(v.occasion) ? v.occasion : null;

  // Exclusions and hardExclusions run through the same vocabulary filter as
  // moodTags — "not Thai" (or "allergic to shellfish") has to resolve to a
  // real catalog term to be honoured, and one the ranker can't match is worse
  // than none: the guest would be told it was applied when it wasn't.
  return {
    intent,
    domains: parseDomains(v.domains),
    exclusions: parseMoodTags(v.exclusions, vocabulary),
    hardExclusions: parseMoodTags(v.hardExclusions, vocabulary),
    occasion,
    rawText: v.rawText,
    pace,
    budget,
    moodTags: parseMoodTags(v.moodTags, vocabulary),
    timeWindow: { startsBy, backBy },
    wantsNightlife: v.wantsNightlife,
    confidence: v.confidence,
  };
}


/** True when a request validated structurally but carries no usable signal —
 * the model's honest "low confidence, nothing to go on" for a nonsense or
 * off-topic sentence. Also true for a null request (failed validation
 * entirely). Callers should route to browsing rather than building a plan
 * from this: a request this empty produces a "confident-looking" plan built
 * from taste history alone, which is indistinguishable on screen from a real
 * match — the guest has no way to tell the guess from the plan (CLAUDE.md #5).
 * Single source of truth for AskSheet and eval-concierge.ts so "what counts as
 * a decline" can't drift between the app and its own test harness. */
export function conciergeDeclined(request: ConciergeRequest | null): boolean {
  if (!request) return true;
  return request.confidence === 'low' && !request.pace && !request.budget && request.moodTags.length === 0;
}
