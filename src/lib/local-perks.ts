import { homeGuideHref, homeGuideKey, type HomeGuideCatalog, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { isRegionalPoint } from '@/lib/regional-nearby';
import type { GeoPoint } from '@/lib/geo';

export function perksAreaKey(city: string, device?: (GeoPoint & { label?: string }) | null): string {
  const label = isRegionalPoint(device) ? device.label?.split(',')[0]?.trim() : undefined;
  return label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : city;
}

export type LocalOffer = {
  id: string; title: string; label: string; description: string; url: string;
  venue: string; venueKey: string; href: string; image?: string; verifiedAt?: string;
};
export type EveningStop = Pick<HomeGuideEntry, 'kind' | 'id' | 'name' | 'caption' | 'image' | 'glyph' | 'facts'> & { city: string };
export const eveningStopKey = (entry: Pick<EveningStop, 'kind' | 'id'>) => homeGuideKey(entry.kind, entry.id);
export const MAX_EVENING_STOPS = 8;

/** Offers only come from this location's source records, never a city-wide
 * promo fixture. A restaurant's promotion is not a Wayvee discount. */
export function localOffers(catalog: HomeGuideCatalog): LocalOffer[] {
  const seen = new Set<string>();
  return Object.values(catalog.entries).flatMap(entry => (entry.detailContent?.offers || []).flatMap(offer => {
    if (!offer.title || !/^https?:\/\//i.test(offer.url)) return [];
    const id = offer.url + '#' + offer.title.toLowerCase();
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ ...offer, id, venue: entry.name, venueKey: homeGuideKey(entry.kind, entry.id), href: homeGuideHref(entry), image: entry.image,
      verifiedAt: entry.detailContent?.verifiedAt }];
  }));
}

export function compactOffer(offer: LocalOffer): { title: string; detail: string } {
  if (/2 buck shuck/i.test(offer.title)) {
    const oysters = offer.description.match(/\$[\d.]+\s+oysters/i)?.[0];
    const minimum = offer.description.match(/minimum\s+\d+/i)?.[0];
    return { title: oysters || offer.title, detail: [offer.label.replace('Daily ·', 'Daily,'), minimum?.replace(/^m/, 'M')].filter(Boolean).join(' · ') };
  }
  return { title: offer.title, detail: offer.label || offer.description };
}

/** One useful, location-scoped result per identity. Source order
 * keeps the nearest pool's distance ranking intact. */
export function perksEntries(catalog: HomeGuideCatalog, category: HomeGuideCategory): HomeGuideEntry[] {
  const seen = new Set<string>();
  return catalog.categories[category].filter(entry => {
    const key = entry.name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function toggleEveningStop(stops: readonly EveningStop[], stop: EveningStop): EveningStop[] {
  const key = eveningStopKey(stop);
  if (stops.some(item => eveningStopKey(item) === key && item.city === stop.city)) {
    return stops.filter(item => !(eveningStopKey(item) === key && item.city === stop.city));
  }
  if (stops.filter(item => item.city === stop.city).length >= MAX_EVENING_STOPS) return [...stops];
  return [...stops, stop];
}

/** Easter eggs suggest a real, nearby alternative; they never unlock a
 * financial reward or fabricate an exclusive place. */
export function veeWildcard(catalog: HomeGuideCatalog, roll: number): HomeGuideEntry | undefined {
  const seen = new Set<string>();
  const pool = [...catalog.categories.bars, ...catalog.categories.eat, ...catalog.categories.routes].filter(entry => {
    const key = homeGuideKey(entry.kind, entry.id);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return pool.length ? pool[((roll % pool.length) + pool.length) % pool.length] : undefined;
}
