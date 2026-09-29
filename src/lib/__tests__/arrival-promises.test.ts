// The arrival sequence prints TRIP_CONTEXT_EFFECTS verbatim, and its own doc
// comment says the ranker has to honour those claims — "a claim here with no
// matching behaviour is the 'Recommended for you' failure the design doc exists
// to prevent". These tests hold the printed copy to the code behind it.
import { defaultDinnerMinutes, LANDMARK_VENUE_IDS, TRIP_CONTEXTS, TRIP_CONTEXT_EFFECTS } from '@/lib/arrival';
import { VENUES } from '@/lib/data';

describe('defaultDinnerMinutes', () => {
  it('gives a visitor 6:30, the hour the arrival copy names', () => {
    expect(defaultDinnerMinutes('visiting')).toBe(18 * 60 + 30);
  });

  it('gives a work trip an earlier 6', () => {
    expect(defaultDinnerMinutes('work')).toBe(18 * 60);
  });

  it('leaves a local alone — their copy promises nothing about dinner', () => {
    expect(defaultDinnerMinutes('live')).toBeNull();
    expect(defaultDinnerMinutes(null)).toBeNull();
  });

  it('is earlier than the neutral 7 PM wherever it has an opinion', () => {
    for (const context of TRIP_CONTEXTS) {
      const minutes = defaultDinnerMinutes(context);
      if (minutes !== null) expect(minutes).toBeLessThan(19 * 60);
    }
  });
});

describe('LANDMARK_VENUE_IDS', () => {
  it('names only venues the catalog actually holds', () => {
    for (const id of LANDMARK_VENUE_IDS) {
      expect(VENUES[id]).toBeDefined();
    }
  });
});

describe('TRIP_CONTEXT_EFFECTS', () => {
  it('covers every context the arrival sequence can store', () => {
    for (const context of TRIP_CONTEXTS) {
      expect(TRIP_CONTEXT_EFFECTS[context]?.effect).toBeTruthy();
    }
  });

  it('only claims a landmark effect for the two contexts that have one', () => {
    const claims = TRIP_CONTEXTS.filter((c) => /landmark/i.test(TRIP_CONTEXT_EFFECTS[c].effect));
    expect(claims.sort()).toEqual(['live', 'visiting']);
  });

  it('only claims an earlier dinner for the two contexts that have one', () => {
    const claims = TRIP_CONTEXTS.filter((c) => /dinner defaults/i.test(TRIP_CONTEXT_EFFECTS[c].effect));
    expect(claims.sort()).toEqual(['visiting', 'work']);
  });
});
