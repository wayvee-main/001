import { CITY_CENTER, milesBetween } from '@/lib/geo';
import { NEAREST_HOME_LIMIT, rankNearestPlaces } from '@/lib/nearby-pool';
import type { Place } from '@/lib/places';
import type { Restaurant } from '@/lib/data';

const place = (id: string, lat = CITY_CENTER.latitude, lon = CITY_CENTER.longitude): Place => ({
  id, name: id, category: 'restaurant', cuisine: null, address: null,
  lat, lon, website: null, phone: null, image: null, openingHours: null,
  confidence: 'osm_only', needsReview: false,
});
const noCoords = () => null;

describe('Nearest city-reference pool', () => {
  it('populates 20+ places without GPS and exposes 20 Home cards', () => {
    const places = Array.from({ length: 24 }, (_, i) => place(`p${i}`, CITY_CENTER.latitude + i * 0.001));
    const ranked = rankNearestPlaces([], places, noCoords, CITY_CENTER, null);
    expect(ranked).toHaveLength(24);
    expect(ranked.slice(0, NEAREST_HOME_LIMIT)).toHaveLength(20);
    expect(ranked[0].miles).toBe(0);
  });

  it('keeps the same five-mile pool while GPS reverses the order', () => {
    const a = place('a');
    const b = place('b', CITY_CENTER.latitude + 0.04);
    const outside = place('outside', CITY_CENTER.latitude + 0.08);
    expect(milesBetween(CITY_CENTER, { latitude: outside.lat, longitude: outside.lon })).toBeGreaterThan(5);
    const phone = { latitude: outside.lat, longitude: outside.lon };
    expect(rankNearestPlaces([], [a, b, outside], noCoords, CITY_CENTER, null).map((p) => p.name)).toEqual(['a', 'b']);
    const ranked = rankNearestPlaces([], [a, b, outside], noCoords, CITY_CENTER, phone);
    expect(ranked.map((p) => p.name)).toEqual(['b', 'a']);
    expect(ranked[0].miles).toBeCloseTo(milesBetween(phone, { latitude: b.lat, longitude: b.lon }));
  });

  it('uses SF’s reference independently of Oakland', () => {
    const sf = { latitude: 37.7749, longitude: -122.4194 };
    const places = [place('oakland'), place('sf', sf.latitude, sf.longitude)];
    expect(rankNearestPlaces([], places, noCoords, sf, null).map((p) => p.name)).toEqual(['sf']);
  });

  it('falls back for invalid GPS and omits invalid place coordinates', () => {
    const ranked = rankNearestPlaces([], [place('good'), place('bad', NaN)], noCoords, CITY_CENTER, { latitude: NaN, longitude: 0 });
    expect(ranked.map((p) => p.name)).toEqual(['good']);
    expect(ranked[0].miles).toBe(0);
    expect(rankNearestPlaces([], [place('good')], noCoords, null, CITY_CENTER)).toEqual([]);
  });

  it('links matched curated entries once and directory-only entries to their own detail', () => {
    const restaurant = { id: 'curated', name: 'A', cuisine: 'Thai', price: '$$', image: '', menuHighlights: [] } as unknown as Restaurant;
    const ranked = rankNearestPlaces([restaurant], [{ ...place('osm-a'), name: 'A' }, place('osm-b', CITY_CENTER.latitude + 0.01)], () => CITY_CENTER, CITY_CENTER, null);
    expect(ranked.map((p) => p.href)).toEqual(['/restaurant/curated', '/place/osm-b']);
  });

  it('does not pad sparse coverage or manufacture facts', () => {
    const ranked = rankNearestPlaces([], [place('one'), { ...place('review'), needsReview: true }], noCoords, CITY_CENTER, null);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].price).toBeUndefined();
    expect(ranked[0].hours).toBeNull();
  });
});
