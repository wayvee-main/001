import { publicDetailUrl } from '@/lib/detail-content';
import { homeGuideHref, homeGuideKey, type HomeGuideEntry, type HomeGuideFact } from '@/lib/home-guide';
import { compactOffer } from '@/lib/local-perks';

export type MetadataTone = 'category' | 'distance' | 'menu' | 'offer';
export type CardMetadataItem = { key: string; text: string; glyph?: string; tone: MetadataTone; label: string };

export function metadataFact(fact: HomeGuideFact, index: number): CardMetadataItem {
  const price = ['wallet', 'dollar'].includes(fact.glyph);
  return { key: fact.glyph + ':' + index, text: fact.value, glyph: price ? undefined : fact.glyph,
    tone: price ? 'offer' : ['pin', 'walk', 'route', 'car'].includes(fact.glyph) ? 'distance' : 'category',
    label: fact.label ? fact.label + '. ' + fact.value : fact.value };
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
