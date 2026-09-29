import { asTitle, composedTitle, countWord, pricePhrase } from '@/lib/hub-copy';

describe('countWord', () => {
  it('spells out what a person would spell out', () => {
    expect(countWord(1)).toBe('one');
    expect(countWord(10)).toBe('ten');
    expect(countWord(12)).toBe('twelve');
  });

  it('switches to digits past twelve', () => {
    expect(countWord(13)).toBe('13');
    expect(countWord(40)).toBe('40');
  });
});

describe('asTitle', () => {
  it('capitalizes without rewording — the guest gets their own words back', () => {
    expect(asTitle('mexican')).toBe('Mexican');
    expect(asTitle('  flat white  ')).toBe('Flat white');
    expect(asTitle('MENSHO')).toBe('MENSHO');
  });

  it('has nothing to say about nothing', () => {
    expect(asTitle('')).toBe('');
    expect(asTitle('   ')).toBe('');
  });
});

describe('composedTitle', () => {
  it('adds the count as a word', () => {
    expect(composedTitle('mexican', 10)).toBe('Mexican, ten ways');
    expect(composedTitle('coffee', 2)).toBe('Coffee, two ways');
  });

  it('gives a lone result its own form rather than saying "one ways"', () => {
    expect(composedTitle('oyster', 1)).toBe('Oyster, just the one');
  });

  it('stays plain when there is nothing to count', () => {
    // The empty state carries "no matches" — the title must not pre-empt it.
    expect(composedTitle('zzzz', 0)).toBe('Zzzz');
  });

  it('never invents a subject', () => {
    expect(composedTitle('', 5)).toBe('');
  });
});

describe('pricePhrase', () => {
  it('reads a spread as a range', () => {
    expect(pricePhrase(['$', '$$', '$$$'])).toBe('budget to splurge');
    expect(pricePhrase(['$', '$$'])).toBe('budget to mid-range');
  });

  it('collapses a single tier instead of repeating itself', () => {
    expect(pricePhrase(['$$'])).toBe('all mid-range');
    expect(pricePhrase(['$$$'])).toBe('all splurge');
  });

  it('says nothing when there are no prices to read', () => {
    // Places carry no price at all, so a places-only result set lands here.
    expect(pricePhrase([])).toBeNull();
    expect(pricePhrase(['£', '€'])).toBeNull();
  });

  it('ignores symbols the catalog never stores', () => {
    expect(pricePhrase(['$', '$$$$'])).toBe('all budget');
  });
});
