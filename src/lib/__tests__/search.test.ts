import { buildSearchIndex, buildVocabulary, queryIndex, suggestFor } from '@/lib/search';

// Both are built from the shipped catalog rather than hand-rolled fixtures:
// this module is what the search overlay runs against in the app, and a
// synthetic index would stop catching the thing most likely to break it —
// a catalog edit that quietly empties a field the ranking leans on.
const vocabulary = buildVocabulary([]);
const index = buildSearchIndex([], []);

describe('buildVocabulary', () => {
  it('pulls real words out of the catalog', () => {
    expect(vocabulary.length).toBeGreaterThan(50);
  });

  it('never offers a blank word', () => {
    expect(vocabulary.every((entry) => entry.word.trim().length > 0)).toBe(true);
  });
});

describe('suggestFor', () => {
  it('stays silent until something is typed', () => {
    expect(suggestFor('', vocabulary)).toEqual([]);
    expect(suggestFor('   ', vocabulary)).toEqual([]);
  });

  it('ranks prefix matches ahead of mid-word ones', () => {
    // "me" hits both: mezcal/Mexican lead, Ramen and khmer only contain it.
    const starts = suggestFor('me', vocabulary).map((s) => s.query.toLowerCase().startsWith('me'));
    expect(starts[0]).toBe(true);
    // Once the list stops leading with prefix matches it never returns to them.
    expect(starts.slice(starts.lastIndexOf(true) + 1).every((hit) => hit === false)).toBe(true);
  });

  it('orders prefix matches shortest first', () => {
    const lengths = suggestFor('me', vocabulary)
      .filter((s) => s.query.toLowerCase().startsWith('me'))
      .map((s) => s.query.length);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
  });

  it('suffixes a cuisine so it reads as a tap target, and leaves other words alone', () => {
    expect(suggestFor('mexican', vocabulary)).toContainEqual({ label: 'Mexican near me', query: 'Mexican' });
    const plain = suggestFor('date night', vocabulary).find((s) => s.query === 'date night');
    expect(plain).toEqual({ label: 'date night', query: 'date night' });
  });

  it('never repeats a word and honours the limit', () => {
    const out = suggestFor('a', vocabulary, 5);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((s) => s.query.toLowerCase())).size).toBe(out.length);
  });
});

describe('queryIndex', () => {
  it('stays silent until something is typed', () => {
    expect(queryIndex(index, '')).toEqual([]);
    expect(queryIndex(index, '   ')).toEqual([]);
  });

  it('puts the restaurant above the dishes that share its name', () => {
    const results = queryIndex(index, 'ramen');
    expect(results[0].kind).toBe('restaurant');
    expect(results[0].title).toBe('Itani Ramen');
    expect(results.some((r) => r.kind === 'dish')).toBe(true);
  });

  it('returns results already sorted by score', () => {
    const scores = queryIndex(index, 'oakland').map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('gives every result somewhere to navigate', () => {
    const results = queryIndex(index, 'ramen');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.href.startsWith('/'))).toBe(true);
  });

  it('tolerates a one-character typo rather than dropping to nothing', () => {
    // scoreFields spends an edit budget of 1 on tokens of 4+ characters, 2 from
    // 7 up — so a substitution, insertion or deletion still finds the ramen bar.
    for (const typo of ['ramin', 'rameno', 'ramn']) {
      expect(queryIndex(index, typo).length).toBeGreaterThan(0);
    }
  });

  it('needs a longer word before it can absorb a transposition', () => {
    // Plain Levenshtein scores a swapped pair as two edits, so a short
    // transposition outruns the budget and finds nothing, while the same
    // mistake in a 7-character word is covered. Documented rather than
    // asserted as desirable — "ramne" returning nothing is a real gap.
    expect(queryIndex(index, 'ramne')).toEqual([]);
    expect(queryIndex(index, 'mexcian').length).toBeGreaterThan(0);
  });

  it('lets taste raise a match but never demote one', () => {
    const plain = queryIndex(index, 'ramen');
    const tasted = queryIndex(index, 'ramen', ['Ramen']);
    const byId = new Map(plain.map((r) => [r.id, r.score]));
    for (const result of tasted) {
      expect(result.score).toBeGreaterThanOrEqual(byId.get(result.id) ?? 0);
    }
  });

  it('finds nothing for a word the catalog does not contain', () => {
    expect(queryIndex(index, 'zzzzqqqq')).toEqual([]);
  });
});
