import {
  SIGNAL_DECAY_DAYS,
  SIGNAL_DECAY_FLOOR,
  calculateSignalWeight,
  profileAffinity,
  type TasteProfile,
} from '@/lib/taste';

const DAY_MS = 24 * 60 * 60 * 1000;

function profile(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return { stated: [], observed: [], excluded: [], visitedRecently: [], ...overrides };
}

describe('calculateSignalWeight — decay', () => {
  it('leaves a signal recorded now at full strength', () => {
    const now = Date.now();
    expect(calculateSignalWeight({ tag: 'Thai', evidence: 'Saved 3 Thai places', weight: 1.8, timestamp: now }, now)).toBe(1.8);
  });

  it('decays to a proportional floor, not an absolute one', () => {
    const now = Date.now();
    const old = (weight: number) => ({ tag: 'Thai', evidence: 'e', weight, timestamp: now - SIGNAL_DECAY_DAYS * DAY_MS });

    // The floor is a fraction of the original weight, so a weak old signal
    // stays weaker than a strong old one — the bug an absolute +0.3 floor hides.
    expect(calculateSignalWeight(old(2), now)).toBeCloseTo(2 * SIGNAL_DECAY_FLOOR, 2);
    expect(calculateSignalWeight(old(1), now)).toBeCloseTo(1 * SIGNAL_DECAY_FLOOR, 2);
    expect(calculateSignalWeight(old(2), now)).toBeGreaterThan(calculateSignalWeight(old(1), now));
  });

  it('does not decay below the floor however old the signal is', () => {
    const now = Date.now();
    const ancient = { tag: 'Thai', evidence: 'e', weight: 2, timestamp: now - 10 * SIGNAL_DECAY_DAYS * DAY_MS };
    expect(calculateSignalWeight(ancient, now)).toBeCloseTo(2 * SIGNAL_DECAY_FLOOR, 2);
  });
});

describe('profileAffinity — terms', () => {
  it('credits stated tags and observed signals, and names the evidence', () => {
    const now = Date.now();
    const result = profileAffinity(
      'Chai Thai Noodles thai food open late',
      profile({
        stated: ['Thai food'],
        observed: [{ tag: 'Thai', evidence: 'Saved 3 Thai places', weight: 1.8, timestamp: now }],
      }),
      {},
      now,
    );

    expect(result.score).toBeCloseTo(2.8, 2);
    expect(result.terms.map((term) => term.reason)).toContain('Saved 3 Thai places');
  });

  it('applies the repetition penalty on a word-boundary match, not a substring', () => {
    const now = Date.now();
    const withVisit = profile({ visitedRecently: ['Mua'] });

    const repeated = profileAffinity('Mua Oakland californian', withVisit, {}, now);
    expect(repeated.terms.some((term) => term.reason.includes('You went to Mua recently'))).toBe(true);
    expect(repeated.score).toBeLessThan(0);

    // "Mua" appears inside "Muakese" — a substring test would wrongly penalise it.
    const unrelated = profileAffinity('Muakese Grill barbecue', withVisit, {}, now);
    expect(unrelated.terms).toHaveLength(0);
    expect(unrelated.score).toBe(0);
  });

  it('ranks an excluded match down rather than to nothing', () => {
    const result = profileAffinity('Sushi Palace japanese', profile({ excluded: ['Sushi'] }));
    expect(result.score).toBeLessThan(0);
    expect(result.terms.some((term) => term.reason === 'You ruled out Sushi' && !term.isPositive)).toBe(true);
  });

  it('folds distance, budget and hours terms in alongside taste', () => {
    const result = profileAffinity('Farmhouse Kitchen thai', profile(), {
      walkMinutes: 6,
      budgetMatches: true,
      budgetLabel: '$$',
      openLabel: 'Open till 10 PM',
    });

    expect(result.terms.map((term) => term.reason)).toEqual([
      '6 min walk from you',
      '$$ matches your budget',
      'Open till 10 PM',
    ]);
    expect(result.score).toBeGreaterThan(0);
  });

  it('produces no terms at all for a guest with no profile and no context', () => {
    expect(profileAffinity('Farmhouse Kitchen thai', null)).toEqual({ score: 0, terms: [] });
  });
});
