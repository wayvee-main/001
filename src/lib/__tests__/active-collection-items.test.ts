import { activeCollectionItems, CURATED_COLLECTIONS, RESTAURANTS, type CuratedCollection } from '@/lib/data';
import { EVENTS } from '@/lib/events';
import { applyCurationForCity } from '@/lib/curation';
import { BUNDLE_CITY } from '@/lib/city';

const collection = (items: CuratedCollection['items']): CuratedCollection => ({ ...CURATED_COLLECTIONS['late-night'], items });
afterEach(() => applyCurationForCity(BUNDLE_CITY));

describe('active collection entries during city changes', () => {
  it('omits missing event records instead of crashing when a catalog is cleared', () => {
    expect(activeCollectionItems(collection([{ type: 'event', id: 'unavailable-event' }]))).toEqual([]);
  });
  it('omits restaurant references that are absent in the active catalog', () => {
    expect(activeCollectionItems(collection([{ type: 'restaurant', id: 'unavailable-restaurant' }]))).toEqual([]);
  });
  it('keeps an available restaurant and restores it after returning to Oakland', () => {
    const id = Object.keys(RESTAURANTS)[0], entry = collection([{ type: 'restaurant', id }]);
    expect(activeCollectionItems(entry)).toHaveLength(1);
    applyCurationForCity('san-francisco');
    expect(activeCollectionItems(entry)).toEqual([]);
    applyCurationForCity(BUNDLE_CITY);
    expect(activeCollectionItems(entry)).toHaveLength(1);
  });
  it('keeps a current event alongside valid restaurants, skipping unavailable references', () => {
    const event = Object.values(EVENTS).find((item) => item.startsAt)!;
    const restaurant = Object.keys(RESTAURANTS)[0];
    const entries: CuratedCollection['items'] = [{ type: 'event', id: event.id }, { type: 'restaurant', id: restaurant }];
    expect(activeCollectionItems(collection([...entries, { type: 'event', id: 'missing' }]), new Date(event.startsAt!))).toEqual(entries);
  });
  it('still removes expired events', () => {
    const event = Object.values(EVENTS).find((item) => item.startsAt)!;
    const later = new Date(new Date(event.startsAt!).getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(activeCollectionItems(collection([{ type: 'event', id: event.id }]), later)).toEqual([]);
  });
});
