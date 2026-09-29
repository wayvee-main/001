import { coordsForCurated, type Place } from '@/lib/places';

function place(overrides: Partial<Place> & { id: string; name: string; lat: number; lon: number }): Place {
  return {
    category: 'restaurant',
    cuisine: null,
    address: null,
    website: null,
    phone: null,
    image: null,
    openingHours: null,
    confidence: 'cross_confirmed',
    needsReview: false,
    ...overrides,
  };
}

const FARMHOUSE = place({ id: 'p1', name: 'Farmhouse Kitchen Thai Cuisine', lat: 37.8021, lon: -122.2707, address: '336 Water St' });
const COOK = place({ id: 'p2', name: 'The Cook & Her Farmer', lat: 37.8009, lon: -122.2761, address: '907 Washington St' });
const MAGO = place({ id: 'p3', name: 'Mägo', lat: 37.8143, lon: -122.2681, address: '3762 Piedmont Ave' });

describe('coordsForCurated', () => {
  it('returns null when no places have hydrated', () => {
    expect(coordsForCurated({ name: 'Farmhouse Kitchen' }, [])).toBeNull();
  });

  it('matches on name alone when the curated entry has no address', () => {
    expect(coordsForCurated({ name: 'The Cook and Her Farmer' }, [COOK])).toEqual({ latitude: 37.8009, longitude: -122.2761 });
  });

  it('ignores accents and punctuation differences', () => {
    expect(coordsForCurated({ name: 'Mägo', address: '3762 Piedmont Ave' }, [MAGO])).toEqual({ latitude: 37.8143, longitude: -122.2681 });
  });

  it('rejects a same-name match at a different street number', () => {
    expect(coordsForCurated({ name: 'The Cook and Her Farmer', address: '2925 Broadway' }, [COOK])).toBeNull();
  });

  it('matches a map name that only adds a descriptive tail', () => {
    expect(coordsForCurated({ name: 'Farmhouse Kitchen', address: '336 Water St' }, [FARMHOUSE, COOK])).toEqual({
      latitude: 37.8021,
      longitude: -122.2707,
    });
  });

  it('does not match a curated name more specific than the map name', () => {
    expect(coordsForCurated({ name: 'Farmhouse Kitchen Thai Cuisine' }, [place({ id: 'p5', name: 'Farmhouse', lat: 37.8, lon: -122.27 })])).toBeNull();
  });

  it('needs a street number to break a same-name collision', () => {
    const second = place({ id: 'p4', name: 'Farmhouse Kitchen Thai Cuisine', lat: 37.7749, lon: -122.4194, address: '710 Florida St' });
    expect(coordsForCurated({ name: 'Farmhouse Kitchen' }, [FARMHOUSE, second])).toBeNull();
    expect(coordsForCurated({ name: 'Farmhouse Kitchen', address: '710 Florida St' }, [FARMHOUSE, second])).toEqual({
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it('returns null for a curated spot the places table does not cover', () => {
    expect(coordsForCurated({ name: 'Somewhere Uncovered', address: '1 Broadway' }, [FARMHOUSE, COOK])).toBeNull();
  });
});
