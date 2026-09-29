import { CITY_CENTER, SERVICE_RADIUS_MILES, isInServiceArea, milesBetween, usableAnchor } from '@/lib/geo';

// Due-north offset makes the haversine distance exact (dLon = 0 collapses
// milesBetween to EARTH_RADIUS_MILES * dLat-in-radians), so these give a
// precise boundary instead of an approximate one from a real city pair.
const EARTH_RADIUS_MILES = 3958.8;
function pointMilesNorth(miles: number) {
  const dLatRad = miles / EARTH_RADIUS_MILES;
  return { latitude: CITY_CENTER.latitude + (dLatRad * 180) / Math.PI, longitude: CITY_CENTER.longitude };
}

describe('isInServiceArea', () => {
  it('is true at the city center', () => {
    expect(isInServiceArea(CITY_CENTER)).toBe(true);
  });

  it('is true just inside the radius', () => {
    expect(isInServiceArea(pointMilesNorth(SERVICE_RADIUS_MILES - 1))).toBe(true);
  });

  it('is false just outside the radius', () => {
    expect(isInServiceArea(pointMilesNorth(SERVICE_RADIUS_MILES + 1))).toBe(false);
  });

  it('is false for a guest continents away', () => {
    const kathmandu = { latitude: 27.7172, longitude: 85.324 };
    expect(milesBetween(CITY_CENTER, kathmandu)).toBeGreaterThan(1000);
    expect(isInServiceArea(kathmandu)).toBe(false);
  });
});

describe('usableAnchor', () => {
  it('returns null for a missing fix', () => {
    expect(usableAnchor(null)).toBeNull();
    expect(usableAnchor(undefined)).toBeNull();
  });

  it('returns the point unchanged when inside the service area', () => {
    const point = pointMilesNorth(5);
    expect(usableAnchor(point)).toEqual(point);
  });

  it('returns null when the fix is outside the service area', () => {
    expect(usableAnchor(pointMilesNorth(SERVICE_RADIUS_MILES + 50))).toBeNull();
  });
});
