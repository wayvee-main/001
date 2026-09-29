import {
  NO_RESTRICTIONS,
  OTHER_RESTRICTION,
  planAroundEffects,
  planAroundSummary,
  togglePlanAroundChip,
} from '@/lib/plan-around';

describe('togglePlanAroundChip', () => {
  it('makes "No restrictions" exclusive in both directions', () => {
    expect(togglePlanAroundChip(['Vegan', 'Halal'], NO_RESTRICTIONS)).toEqual([NO_RESTRICTIONS]);
    expect(togglePlanAroundChip([NO_RESTRICTIONS], 'Vegan')).toEqual(['Vegan']);
  });

  it('falls back to "No restrictions" when the last chip is removed', () => {
    expect(togglePlanAroundChip(['Vegan'], 'Vegan')).toEqual([NO_RESTRICTIONS]);
  });

  it('adds and removes without disturbing the rest', () => {
    expect(togglePlanAroundChip(['Vegan', 'Halal'], 'Low-noise')).toEqual(['Vegan', 'Halal', 'Low-noise']);
    expect(togglePlanAroundChip(['Vegan', 'Halal', 'Low-noise'], 'Halal')).toEqual(['Vegan', 'Low-noise']);
  });
});

describe('planAroundEffects', () => {
  it('treats a dietary need as a preference, never as an exclusion', () => {
    // Excluding "vegetarian" would drop exactly the kitchens a vegetarian
    // wants. Needs rank up; only allergens drop.
    const { preferTags, avoidTerms } = planAroundEffects({ chips: ['Vegetarian'], note: '' });
    expect(preferTags).toContain('vegetarian');
    expect(avoidTerms).toEqual([]);
  });

  it('keeps a constraint the catalog cannot express out of the ranking claims', () => {
    const { preferTags, avoidTerms, contextOnly } = planAroundEffects({
      chips: ['Wheelchair access', 'Low-noise', 'Limited standing', 'No alcohol'],
      note: '',
    });
    expect(preferTags).toEqual([]);
    expect(avoidTerms).toEqual([]);
    expect(contextOnly).toEqual(['Wheelchair access', 'Low-noise', 'Limited standing', 'No alcohol']);
  });

  it('demotes a term to context when nothing in the catalog names it', () => {
    // Halal is a real need with no catalog vocabulary behind it today, so it
    // must not be reported as an applied preference.
    const { preferTags, contextOnly } = planAroundEffects({ chips: ['Halal'], note: '' });
    expect(preferTags).not.toContain('halal');
    expect(contextOnly).toContain('Halal');
  });

  it('carries the free-text note only while "Other" is selected', () => {
    expect(planAroundEffects({ chips: [OTHER_RESTRICTION], note: '  no loud rooms  ' }).contextOnly)
      .toEqual(['no loud rooms']);
    expect(planAroundEffects({ chips: [OTHER_RESTRICTION], note: '   ' }).contextOnly).toEqual([]);
    expect(planAroundEffects({ chips: ['Vegan'], note: 'stale note' }).contextOnly).toEqual([]);
  });

  it('produces nothing at all for the default', () => {
    expect(planAroundEffects({ chips: [NO_RESTRICTIONS], note: '' }))
      .toEqual({ preferTags: [], avoidTerms: [], contextOnly: [] });
  });
});

describe('planAroundSummary', () => {
  it('names every constraint the guest chose, enforceable or not', () => {
    // The guest still needs to see that Wayvee is carrying "Low-noise", even
    // though no catalog field can act on it yet.
    expect(planAroundSummary({ chips: ['Vegan', 'Low-noise'], note: '' })).toBe('Vegan · Low-noise');
  });

  it('substitutes the note for the "Other" chip', () => {
    expect(planAroundSummary({ chips: ['Vegan', OTHER_RESTRICTION], note: 'no stairs' }))
      .toBe('Vegan · no stairs');
  });

  it('says so plainly when there is nothing to plan around', () => {
    expect(planAroundSummary({ chips: [NO_RESTRICTIONS], note: '' })).toBe(NO_RESTRICTIONS);
    expect(planAroundSummary({ chips: [OTHER_RESTRICTION], note: '' })).toBe(NO_RESTRICTIONS);
  });
});
