// Adversarial coverage for the guardrail (src/lib/concierge/request.ts) — the
// one piece of code standing between whatever a model returns and a plan
// getting built from it. Every case here is something a model could plausibly
// emit (a hallucinated enum, an out-of-range time, a tag that isn't in the
// vocabulary) or an attacker could hand-craft directly, since the Edge
// Function's output is never treated as trusted just because it came from
// our own backend. Complements concierge.test.ts, which tests buildPlan
// assuming a request already passed this guardrail.
import { conciergeDeclined, parseConciergeRequest } from '@/lib/concierge/request';
import type { ConciergeRequest } from '@/lib/concierge/types';

const VOCAB = ['cozy', 'lively', 'chill', 'Foodie', 'Outdoors', 'Nightlife'];

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rawText: 'dinner tonight',
    pace: null,
    budget: null,
    moodTags: [],
    timeWindow: { startsBy: null, backBy: null },
    wantsNightlife: false,
    confidence: 'high',
    ...overrides,
  };
}

describe('parseConciergeRequest — guardrail against a hostile or malformed model response', () => {
  it('accepts a fully valid payload', () => {
    expect(parseConciergeRequest(valid(), VOCAB)).not.toBeNull();
  });

  // ── structural nonsense ─────────────────────────────────────────────────
  it('rejects null', () => expect(parseConciergeRequest(null, VOCAB)).toBeNull());
  it('rejects undefined', () => expect(parseConciergeRequest(undefined, VOCAB)).toBeNull());
  it('rejects a bare string', () => expect(parseConciergeRequest('not an object', VOCAB)).toBeNull());
  it('rejects a bare array', () => expect(parseConciergeRequest(['no'], VOCAB)).toBeNull());
  it('rejects a number', () => expect(parseConciergeRequest(42, VOCAB)).toBeNull());
  it('rejects an empty object', () => expect(parseConciergeRequest({}, VOCAB)).toBeNull());

  // ── rawText ──────────────────────────────────────────────────────────────
  it('rejects missing rawText', () => expect(parseConciergeRequest(valid({ rawText: undefined }), VOCAB)).toBeNull());
  it('rejects empty rawText', () => expect(parseConciergeRequest(valid({ rawText: '' }), VOCAB)).toBeNull());
  it('rejects non-string rawText', () => expect(parseConciergeRequest(valid({ rawText: 123 }), VOCAB)).toBeNull());
  it('rejects rawText over 500 chars', () => expect(parseConciergeRequest(valid({ rawText: 'x'.repeat(501) }), VOCAB)).toBeNull());
  it('accepts rawText at exactly 500 chars', () => expect(parseConciergeRequest(valid({ rawText: 'x'.repeat(500) }), VOCAB)).not.toBeNull());

  // ── intent: the highest-consequence field ───────────────────────────────
  // A wrong intent sends the guest to the wrong page, which is far more visible
  // than a slightly-off budget guess — so an unrecognised one fails the parse
  // rather than falling back to a default that always returns something.
  it('rejects a hallucinated intent', () => expect(parseConciergeRequest(valid({ intent: 'book_flight' }), VOCAB)).toBeNull());
  it('rejects an intent with wrong case', () => expect(parseConciergeRequest(valid({ intent: 'Find_Place' }), VOCAB)).toBeNull());
  it('rejects a non-string intent', () => expect(parseConciergeRequest(valid({ intent: 7 }), VOCAB)).toBeNull());
  it('keeps a valid intent', () => expect(parseConciergeRequest(valid({ intent: 'find_place' }), VOCAB)?.intent).toBe('find_place'));
  // Absent is not the same as invalid: responses from before the field existed
  // are read as the only behaviour that existed then.
  it('defaults a missing intent to plan_evening', () =>
    expect(parseConciergeRequest(valid(), VOCAB)?.intent).toBe('plan_evening'));
  it('defaults a null intent to plan_evening', () =>
    expect(parseConciergeRequest(valid({ intent: null }), VOCAB)?.intent).toBe('plan_evening'));

  // ── domains / exclusions ────────────────────────────────────────────────
  it('drops a domain outside the enum', () =>
    expect(parseConciergeRequest(valid({ domains: ['food', 'teleportation'] }), VOCAB)?.domains).toEqual(['food']));
  it('drops non-string domains', () =>
    expect(parseConciergeRequest(valid({ domains: [1, {}, 'drinks'] }), VOCAB)?.domains).toEqual(['drinks']));
  it('dedupes domains', () =>
    expect(parseConciergeRequest(valid({ domains: ['food', 'food'] }), VOCAB)?.domains).toEqual(['food']));

  // An exclusion the ranker can't match is worse than no exclusion: the guest
  // is shown a "Not X" chip for a constraint that was never applied.
  it('drops an exclusion that is not in the taste vocabulary', () =>
    expect(parseConciergeRequest(valid({ exclusions: ['cozy', 'invented-cuisine'] }), VOCAB)?.exclusions).toEqual(['cozy']));
  it('canonicalises exclusion casing to the vocabulary', () =>
    expect(parseConciergeRequest(valid({ exclusions: ['nightlife'] }), VOCAB)?.exclusions).toEqual(['Nightlife']));
  it('treats a non-array exclusions field as none', () =>
    expect(parseConciergeRequest(valid({ exclusions: 'thai' }), VOCAB)?.exclusions).toEqual([]));

  // ── hardExclusions: same vocabulary guardrail as exclusions ─────────────
  it('drops a hard exclusion that is not in the taste vocabulary', () =>
    expect(parseConciergeRequest(valid({ hardExclusions: ['cozy', 'invented-allergen'] }), VOCAB)?.hardExclusions).toEqual(['cozy']));
  it('canonicalises hard exclusion casing to the vocabulary', () =>
    expect(parseConciergeRequest(valid({ hardExclusions: ['nightlife'] }), VOCAB)?.hardExclusions).toEqual(['Nightlife']));
  it('treats a missing hardExclusions field as none rather than failing the parse', () =>
    expect(parseConciergeRequest(valid(), VOCAB)?.hardExclusions).toEqual([]));

  // ── occasion: hallucinated / wrong-shape enum ────────────────────────────
  it('rejects an occasion value outside the enum', () => expect(parseConciergeRequest(valid({ occasion: 'business_trip' }), VOCAB)).toBeNull());
  it('rejects an occasion value with wrong case', () => expect(parseConciergeRequest(valid({ occasion: 'Date_Night' }), VOCAB)).toBeNull());
  it('accepts a null occasion', () => expect(parseConciergeRequest(valid({ occasion: null }), VOCAB)?.occasion).toBeNull());
  it('accepts a missing occasion field, defaulting to null', () => expect(parseConciergeRequest(valid(), VOCAB)?.occasion).toBeNull());
  it('accepts a valid occasion value', () => expect(parseConciergeRequest(valid({ occasion: 'date_night' }), VOCAB)?.occasion).toBe('date_night'));

  // ── pace: hallucinated / wrong-shape enum ───────────────────────────────
  it('rejects a pace value outside the enum', () => expect(parseConciergeRequest(valid({ pace: 'Extreme' }), VOCAB)).toBeNull());
  it('rejects a pace value with wrong case', () => expect(parseConciergeRequest(valid({ pace: 'relaxed' }), VOCAB)).toBeNull());
  it('rejects a numeric pace', () => expect(parseConciergeRequest(valid({ pace: 1 }), VOCAB)).toBeNull());
  it('accepts a null pace', () => expect(parseConciergeRequest(valid({ pace: null }), VOCAB)).not.toBeNull());

  // ── budget: hallucinated / wrong-shape enum ──────────────────────────────
  it('rejects a budget value outside the enum', () => expect(parseConciergeRequest(valid({ budget: '$$$$' }), VOCAB)).toBeNull());
  it('rejects a budget value that is not a currency symbol at all', () => expect(parseConciergeRequest(valid({ budget: 'expensive' }), VOCAB)).toBeNull());

  // ── moodTags: the hallucination surface with the highest stakes, since a
  // fabricated tag could otherwise reach ranking as if it were a real signal ──
  it('drops a tag not in the vocabulary rather than failing the whole parse', () => {
    const result = parseConciergeRequest(valid({ moodTags: ['cozy', 'invented-vibe'] }), VOCAB);
    expect(result?.moodTags).toEqual(['cozy']);
  });
  it('drops every tag when none are in the vocabulary, still returns a request', () => {
    const result = parseConciergeRequest(valid({ moodTags: ['made-up-1', 'made-up-2'] }), VOCAB);
    expect(result?.moodTags).toEqual([]);
  });
  it('matches vocabulary case-insensitively but preserves the vocabulary casing intent', () => {
    const result = parseConciergeRequest(valid({ moodTags: ['COZY'] }), VOCAB);
    expect(result?.moodTags).toEqual(['cozy']);
  });
  it('deduplicates repeated tags', () => {
    const result = parseConciergeRequest(valid({ moodTags: ['cozy', 'cozy', 'Cozy'] }), VOCAB);
    expect(result?.moodTags).toHaveLength(1);
  });
  it('caps moodTags at 8 even if the vocabulary and model both offer more', () => {
    const bigVocab = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const result = parseConciergeRequest(valid({ moodTags: bigVocab }), bigVocab);
    expect(result?.moodTags.length).toBeLessThanOrEqual(8);
  });
  it('ignores non-string entries mixed into moodTags', () => {
    const result = parseConciergeRequest(valid({ moodTags: ['cozy', 42, null, {}] }), VOCAB);
    expect(result?.moodTags).toEqual(['cozy']);
  });
  it('treats a non-array moodTags as empty rather than failing the parse', () => {
    const result = parseConciergeRequest(valid({ moodTags: 'cozy' }), VOCAB);
    expect(result?.moodTags).toEqual([]);
  });

  // ── timeWindow: format and shape ─────────────────────────────────────────
  it('rejects a 12-hour time string ("10pm" instead of "22:00")', () => {
    expect(parseConciergeRequest(valid({ timeWindow: { startsBy: null, backBy: '10pm' } }), VOCAB)).toBeNull();
  });
  it('rejects an out-of-range hour ("25:00")', () => {
    expect(parseConciergeRequest(valid({ timeWindow: { startsBy: null, backBy: '25:00' } }), VOCAB)).toBeNull();
  });
  it('rejects an out-of-range minute ("10:60")', () => {
    expect(parseConciergeRequest(valid({ timeWindow: { startsBy: null, backBy: '10:60' } }), VOCAB)).toBeNull();
  });
  it('accepts a valid midnight time ("00:00")', () => {
    expect(parseConciergeRequest(valid({ timeWindow: { startsBy: null, backBy: '00:00' } }), VOCAB)).not.toBeNull();
  });
  it('treats a wholly missing timeWindow as "no time constraint" rather than rejecting the parse — consistent with how a non-array moodTags is tolerated, not fatal', () => {
    const result = parseConciergeRequest(valid({ timeWindow: undefined }), VOCAB);
    expect(result?.timeWindow).toEqual({ startsBy: null, backBy: null });
  });
  it('rejects a non-time-string, non-null startsBy', () => {
    expect(parseConciergeRequest(valid({ timeWindow: { startsBy: 'soonish', backBy: null } }), VOCAB)).toBeNull();
  });

  // ── wantsNightlife / confidence: type and enum strictness ────────────────
  it('rejects a non-boolean wantsNightlife', () => expect(parseConciergeRequest(valid({ wantsNightlife: 'yes' }), VOCAB)).toBeNull());
  it('rejects a missing wantsNightlife', () => expect(parseConciergeRequest(valid({ wantsNightlife: undefined }), VOCAB)).toBeNull());
  it('rejects a confidence value outside the enum', () => expect(parseConciergeRequest(valid({ confidence: 'certain' }), VOCAB)).toBeNull());
  it('rejects a missing confidence', () => expect(parseConciergeRequest(valid({ confidence: undefined }), VOCAB)).toBeNull());

  // ── prototype-pollution-style keys shouldn't crash or leak ───────────────
  it('does not choke on a payload with a __proto__ key', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "rawText": "test", "pace": null, "budget": null, "moodTags": [], "timeWindow": {"startsBy": null, "backBy": null}, "wantsNightlife": false, "confidence": "high"}');
    expect(() => parseConciergeRequest(malicious, VOCAB)).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

function declined(overrides: Partial<ConciergeRequest> = {}): ConciergeRequest {
  return {
    intent: 'plan_evening',
    domains: [],
    exclusions: [],
    hardExclusions: [],
    occasion: null,
    rawText: 'asdkj purple elephant',
    pace: null,
    budget: null,
    moodTags: [],
    timeWindow: { startsBy: null, backBy: null },
    wantsNightlife: false,
    confidence: 'low',
    ...overrides,
  };
}

describe('conciergeDeclined — single source of truth for "route to browse instead"', () => {
  it('declines a null request', () => expect(conciergeDeclined(null)).toBe(true));
  it('declines low confidence with nothing else usable', () => expect(conciergeDeclined(declined())).toBe(true));
  it('does not decline low confidence if pace was extracted', () => expect(conciergeDeclined(declined({ pace: 'Relaxed' }))).toBe(false));
  it('does not decline low confidence if budget was extracted', () => expect(conciergeDeclined(declined({ budget: '$' }))).toBe(false));
  it('does not decline low confidence if a mood tag was extracted', () => expect(conciergeDeclined(declined({ moodTags: ['cozy'] }))).toBe(false));
  it('does not decline a high-confidence request with no constraints ("surprise me")', () => {
    expect(conciergeDeclined(declined({ confidence: 'high' }))).toBe(false);
  });
  it('does not decline a medium-confidence empty request', () => {
    expect(conciergeDeclined(declined({ confidence: 'medium' }))).toBe(false);
  });
});
