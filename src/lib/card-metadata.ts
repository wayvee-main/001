import { numericDistanceLabel } from '@/lib/card-presentation';
import { publicDetailUrl } from '@/lib/detail-content';
import { homeGuideHref, homeGuideKey, type HomeGuideEntry, type HomeGuideFact } from '@/lib/home-guide';
import { compactOffer } from '@/lib/local-perks';

export type MetadataTone = 'category' | 'distance' | 'menu' | 'offer';
export type CardMetadataItem = { key: string; text: string; glyph?: string; tone: MetadataTone; label: string };

export function metadataFact(fact: HomeGuideFact, index: number): CardMetadataItem {
  const price = ['wallet', 'dollar'].includes(fact.glyph);
  return { key: fact.glyph + ':' + index, text: numericDistanceLabel(fact.value), glyph: price ? undefined : fact.glyph,
    tone: price ? 'offer' : ['pin', 'walk', 'route', 'car'].includes(fact.glyph) ? 'distance' : 'category',
    label: numericDistanceLabel(fact.label ? fact.label + '. ' + fact.value : fact.value) };
}

/** Keep source facts intact. A short pool stays short; never invent ratings,
 * opening states, menus or promotions to fill three symmetrical slots. */
export function cardMetadata(entry: HomeGuideEntry, now: Date, limit: 2 | 3 = 3): { items: CardMetadataItem[]; note?: string } {
  const facts = entry.facts.filter(fact => fact.value.trim() && ['wallet', 'dollar', 'pin', 'clock', 'calendar', 'walk', 'route', 'car'].includes(fact.glyph)).slice(0, 2);
  const items = facts.map(metadataFact);
  const content = entry.detailContent;
  if ((content?.menu?.items.length || content?.menuDocuments?.length) && items.length < limit) {
    items.push({ key: 'menu', text: 'Menu', glyph: 'book', tone: 'menu', label: 'Published menu available' });
  }
  const offer = content?.offers?.find(item => item.title.trim() && publicDetailUrl(item.url) && (!item.expiresAt || Number.isFinite(Date.parse(item.expiresAt)) && Date.parse(item.expiresAt) > now.getTime()));
  if (offer && items.length < limit) {
    const copy = compactOffer({ ...offer, id: offer.url + '#' + offer.title, venue: entry.name,
      venueKey: homeGuideKey(entry.kind, entry.id), href: homeGuideHref(entry) });
    items.push({ key: 'offer', text: copy.title, glyph: 'tag', tone: 'offer', label: [offer.title, offer.label, offer.description].filter(Boolean).join('. ') });
    return { items: items.slice(0, limit), note: copy.detail };
  }
  return { items: items.slice(0, limit) };
}

/** Home's Soft Edit keeps two useful facts: a published menu and location
 * first, then the available source facts. Full offer terms stay in the ribbon
 * and detail page rather than repeating under the venue name. */
export function homeCardMetadata(entry: HomeGuideEntry, now: Date): CardMetadataItem[] {
  const items = cardMetadata(entry, now).items;
  const locationIndex = entry.facts.findIndex(fact => fact.value.trim() && ['pin', 'walk', 'route', 'car'].includes(fact.glyph));
  const location = locationIndex >= 0 ? metadataFact(entry.facts[locationIndex], locationIndex) : undefined;
  // Narrative availability notes belong in detail, not a shrinking Home pill.
  const conciseFacts = items.filter(item => item.tone !== 'distance' && item.text.trim().length <= 28);
  const candidates = [items.find(item => item.key === 'menu'), location, ...conciseFacts];
  const result: CardMetadataItem[] = [];
  for (const item of candidates) {
    if (item && !result.some(existing => existing.tone === item.tone && existing.glyph === item.glyph && existing.text === item.text)) result.push(item);
    if (result.length === 2) break;
  }
  return result;
}
