import { spokenVibes, vibeLabel } from '@/lib/vibe-label';

describe('vibeLabel', () => {
  it('names the empty set rather than rendering a blank pill', () => {
    expect(vibeLabel([])).toBe('Any vibe');
  });

  it('shows a single choice in full', () => {
    expect(vibeLabel(['Foodie'])).toBe('Foodie');
  });

  it('counts the rest rather than truncating them', () => {
    expect(vibeLabel(['Foodie', 'Nightlife'])).toBe('Foodie +1');
    expect(vibeLabel(['Foodie', 'Outdoors', 'Nightlife'])).toBe('Foodie +2');
  });
});

describe('spokenVibes', () => {
  it('never says "+1" out loud', () => {
    expect(spokenVibes(['Foodie', 'Nightlife'])).toBe('Foodie and Nightlife');
    expect(spokenVibes(['Foodie', 'Outdoors', 'Nightlife'])).toBe('Foodie, Outdoors and Nightlife');
  });

  it('reads the empty and single cases as plain values', () => {
    expect(spokenVibes([])).toBe('any vibe');
    expect(spokenVibes(['Outdoors'])).toBe('Outdoors');
  });
});
