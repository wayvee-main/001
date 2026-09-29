import { answerFacts, exclusionLabel, spokenExclusions } from '@/lib/answer-facts';

describe('exclusionLabel', () => {
  it('says nothing when nothing is excluded', () => {
    expect(exclusionLabel([])).toBeNull();
  });

  it('names a single exclusion in full', () => {
    expect(exclusionLabel(['seafood'])).toBe('Not seafood');
  });

  it('counts the rest rather than listing them', () => {
    expect(exclusionLabel(['seafood', 'pork'])).toBe('Not seafood +1');
    expect(exclusionLabel(['seafood', 'pork', 'dairy'])).toBe('Not seafood +2');
  });
});

describe('spokenExclusions', () => {
  it('never says "+2" out loud', () => {
    expect(spokenExclusions(['seafood', 'pork'])).toBe('not seafood or pork');
    expect(spokenExclusions(['seafood', 'pork', 'dairy'])).toBe('not seafood, pork or dairy');
  });

  it('is null when there is nothing to exclude', () => {
    expect(spokenExclusions([])).toBeNull();
  });
});

describe('answerFacts', () => {
  it('returns nothing on a declined answer, so the strip draws nothing', () => {
    expect(answerFacts({})).toEqual([]);
    expect(answerFacts({ budget: null, exclusions: [], matchCount: 0 })).toEqual([]);
  });

  it('spends the accent on price and the open tone on the count', () => {
    expect(answerFacts({ budget: '$$', matchCount: 6 })).toEqual([
      { glyph: 'wallet', label: '$$', tone: 'accent' },
      { glyph: 'spark', label: '6 top matches', tone: 'open' },
    ]);
  });

  it('singularises one match', () => {
    expect(answerFacts({ matchCount: 1 })[0].label).toBe('1 top match');
  });

  it('omits a zero count rather than saying "0 matches" over an empty list', () => {
    expect(answerFacts({ budget: '$', matchCount: 0 })).toEqual([
      { glyph: 'wallet', label: '$', tone: 'accent' },
    ]);
  });

  it('keeps the count when several things are excluded', () => {
    const facts = answerFacts({ budget: '$', exclusions: ['seafood', 'pork', 'dairy'], matchCount: 4 });
    expect(facts).toHaveLength(3);
    expect(facts.map((f) => f.label)).toEqual(['$', 'Not seafood +2', '4 top matches']);
  });
});
