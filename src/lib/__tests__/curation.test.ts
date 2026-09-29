import { BUNDLE_CITY, cityCacheKey } from '@/lib/city';
import { applyCurationForCity, hasCuratedCatalog } from '@/lib/curation';
import { CRAWLS, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES } from '@/lib/data';

// The curated catalog is Oakland's, shipped in the bundle and read directly in
// roughly two hundred places. Scoping it by emptying and refilling in place is
// what keeps those reads correct without touching them — which only works if
// the refill is exact. These tests are the guard on that.

const bundledRestaurants = Object.keys(RESTAURANTS).length;
const bundledVenues = Object.keys(VENUES).length;
const bundledCrawls = Object.keys(CRAWLS).length;
const bundledNightlife = NIGHTLIFE_SPOTS.length;

afterEach(() => {
  applyCurationForCity(BUNDLE_CITY);
});

describe('applyCurationForCity', () => {
  it('ships a non-empty Oakland catalog to begin with', () => {
    expect(bundledRestaurants).toBeGreaterThan(0);
    expect(bundledVenues).toBeGreaterThan(0);
    expect(bundledNightlife).toBeGreaterThan(0);
  });

  it('empties every curated collection for a city that has none', () => {
    applyCurationForCity('san-francisco');

    expect(Object.keys(RESTAURANTS)).toHaveLength(0);
    expect(Object.keys(VENUES)).toHaveLength(0);
    expect(Object.keys(CRAWLS)).toHaveLength(0);
    expect(NIGHTLIFE_SPOTS).toHaveLength(0);
  });

  it('restores the full catalog on returning to Oakland', () => {
    applyCurationForCity('san-jose');
    applyCurationForCity(BUNDLE_CITY);

    expect(Object.keys(RESTAURANTS)).toHaveLength(bundledRestaurants);
    expect(Object.keys(VENUES)).toHaveLength(bundledVenues);
    expect(Object.keys(CRAWLS)).toHaveLength(bundledCrawls);
    expect(NIGHTLIFE_SPOTS).toHaveLength(bundledNightlife);
  });

  it('does not accumulate duplicates when applied repeatedly', () => {
    applyCurationForCity(BUNDLE_CITY);
    applyCurationForCity(BUNDLE_CITY);

    expect(Object.keys(RESTAURANTS)).toHaveLength(bundledRestaurants);
    expect(NIGHTLIFE_SPOTS).toHaveLength(bundledNightlife);
  });

  it('keeps the same object identities, since callers hold references', () => {
    const restaurants = RESTAURANTS;
    const nightlife = NIGHTLIFE_SPOTS;

    applyCurationForCity('berkeley');
    applyCurationForCity(BUNDLE_CITY);

    expect(RESTAURANTS).toBe(restaurants);
    expect(NIGHTLIFE_SPOTS).toBe(nightlife);
  });
});

describe('hasCuratedCatalog', () => {
  it('is true only for the city the bundle describes', () => {
    expect(hasCuratedCatalog(BUNDLE_CITY)).toBe(true);
    expect(hasCuratedCatalog('san-francisco')).toBe(false);
  });
});

describe('cityCacheKey', () => {
  it('gives each city its own key, so one never restores into another', () => {
    expect(cityCacheKey('wayvee.places.cache.v1', 'oakland')).not.toBe(
      cityCacheKey('wayvee.places.cache.v1', 'san-francisco'),
    );
  });

  it('keeps the base key as a prefix, so existing key conventions still hold', () => {
    expect(cityCacheKey('wayvee.places.cache.v1', 'napa')).toBe('wayvee.places.cache.v1.napa');
  });
});
