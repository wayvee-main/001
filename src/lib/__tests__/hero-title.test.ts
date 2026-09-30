import { allHeroTitles, homeHeroPrompt } from '@/lib/daypart';
import { BUNDLE_CITY_NAME } from '@/lib/city';

/** Home's opening line is rendered on one row at display size (home-top.tsx
 * sets numberOfLines={1}). Past four words it truncates, so the rule is not a
 * matter of taste — a longer title is a title the guest cannot finish reading.
 *
 * The city-name rule is the same constraint seen from the multi-city side: a
 * name interpolated into one of these is a word plus however wide that name
 * happens to be, and 'San Francisco' is much wider than 'Oakland'. The header
 * states the city one row above, so these never need to. */
const MAX_WORDS = 4;

describe('hero titles', () => {
  const titles = allHeroTitles();

  it('covers every daypart and trip context', () => {
    // 5 dayparts x (3 trip contexts + default).
    expect(titles).toHaveLength(20);
  });

  it.each(titles)('"%s" is at most four words', (title) => {
    expect(title.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(MAX_WORDS);
  });

  it('names no city', () => {
    // Not just the bundle's city: any of these hardcoded would break the line
    // the moment a second city launches.
    expect(titles.filter((title) => title.includes(BUNDLE_CITY_NAME))).toEqual([]);
  });

  it('fits on a single line, with no break the renderer would have to honour', () => {
    expect(titles.filter((title) => /[\n\r]/.test(title))).toEqual([]);
  });

  it('is what homeHeroPrompt actually serves', () => {
    // The table is only worth testing if it is the thing Home reads from.
    const served = homeHeroPrompt({
      now: new Date(2026, 6, 25, 19, 0, 0),
      tripContext: 'work',
      walkBudgetMinutes: 10,
      tasteTags: [],
    });
    expect(titles).toContain(served);
    expect(served.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
  });
});
