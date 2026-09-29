import {
  canonicalRestaurantHref,
  loadRestaurantExplorations,
  recordRestaurantExploration,
} from '@/lib/exploration-history';
import { getStoredItem, setStoredItem } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  getStoredItem: jest.fn(),
  setStoredItem: jest.fn(),
}));

const mockedGetStoredItem = jest.mocked(getStoredItem);
const mockedSetStoredItem = jest.mocked(setStoredItem);
let stored: string | null;

beforeEach(() => {
  stored = null;
  mockedGetStoredItem.mockReset();
  mockedSetStoredItem.mockReset();
  mockedGetStoredItem.mockImplementation(async () => stored);
  mockedSetStoredItem.mockImplementation(async (_key, value) => {
    stored = value;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('restaurant exploration history', () => {
  it('canonicalizes only internal restaurant routes', () => {
    expect(canonicalRestaurantHref('/restaurant/tacos-oscar?from=dish#menu')).toBe('/restaurant/tacos-oscar');
    expect(canonicalRestaurantHref('/restaurant/tacos-oscar/')).toBe('/restaurant/tacos-oscar');
    expect(canonicalRestaurantHref('/place/tacos-oscar')).toBeNull();
    expect(canonicalRestaurantHref('/restaurant/../profile')).toBeNull();
  });

  it('tolerates corrupt storage and filters malformed stale entries', async () => {
    stored = '{not-json';
    await expect(loadRestaurantExplorations()).resolves.toEqual([]);

    stored = JSON.stringify([
      { href: '/restaurant/good?dish=one', label: ' Good Spot ', count: 2, lastExploredAt: '2026-08-10T10:00:00Z' },
      { href: '/place/not-a-restaurant', label: 'Place', count: 8, lastExploredAt: '2026-08-12T10:00:00Z' },
      { href: '/restaurant/no-count', label: 'No count', lastExploredAt: '2026-08-12T10:00:00Z' },
      { href: '/restaurant/bad-date', label: 'Bad date', count: 1, lastExploredAt: 'yesterdayish' },
      null,
    ]);

    await expect(loadRestaurantExplorations()).resolves.toEqual([
      { href: '/restaurant/good', label: 'Good Spot', count: 2, lastExploredAt: '2026-08-10T10:00:00.000Z' },
    ]);
  });

  it('counts repeated selections and ranks by count before recency', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-14T12:00:00Z'));
    stored = JSON.stringify([
      { href: '/restaurant/steady', label: 'Steady', count: 3, lastExploredAt: '2026-08-01T00:00:00Z' },
      { href: '/restaurant/repeat', label: 'Old label', count: 1, lastExploredAt: '2026-08-13T00:00:00Z' },
    ]);

    const first = await recordRestaurantExploration({ href: '/restaurant/repeat?from=dish', label: 'Repeat' });
    expect(first.map(({ href, count }) => ({ href, count }))).toEqual([
      { href: '/restaurant/steady', count: 3 },
      { href: '/restaurant/repeat', count: 2 },
    ]);

    jest.setSystemTime(new Date('2026-08-14T12:01:00Z'));
    const second = await recordRestaurantExploration({ href: '/restaurant/repeat', label: 'Repeat' });
    expect(second[0]).toEqual({
      href: '/restaurant/repeat',
      label: 'Repeat',
      count: 3,
      lastExploredAt: '2026-08-14T12:01:00.000Z',
    });
    expect(mockedSetStoredItem).toHaveBeenCalledTimes(2);
  });

  it('merges duplicate canonical entries and keeps the latest label', async () => {
    stored = JSON.stringify([
      { href: '/restaurant/same', label: 'Old name', count: 2, lastExploredAt: '2026-08-01T00:00:00Z' },
      { href: '/restaurant/same?source=dish', label: 'New name', count: 3, lastExploredAt: '2026-08-02T00:00:00Z' },
    ]);

    await expect(loadRestaurantExplorations()).resolves.toEqual([
      { href: '/restaurant/same', label: 'New name', count: 5, lastExploredAt: '2026-08-02T00:00:00.000Z' },
    ]);
  });

  it('ignores non-restaurant selections without rewriting storage', async () => {
    await expect(recordRestaurantExploration({ href: '/place/cafe', label: 'Cafe' })).resolves.toEqual([]);
    expect(mockedSetStoredItem).not.toHaveBeenCalled();
  });

  it('caps persisted history at forty entries', async () => {
    stored = JSON.stringify(
      Array.from({ length: 40 }, (_, index) => ({
        href: `/restaurant/${index}`,
        label: `Restaurant ${index}`,
        count: 1,
        lastExploredAt: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(),
      })),
    );

    jest.useFakeTimers().setSystemTime(new Date('2026-08-14T12:00:00Z'));
    const result = await recordRestaurantExploration({ href: '/restaurant/new', label: 'New' });
    expect(result).toHaveLength(40);
    expect(result[0].href).toBe('/restaurant/new');
    expect(result.some((entry) => entry.href === '/restaurant/0')).toBe(false);
  });
});
