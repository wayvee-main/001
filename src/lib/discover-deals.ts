import { hasHappyHour } from '@/lib/discover-categories';
import { homeGuideHref, homeGuideKey, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { compactOffer, localOffers, type LocalOffer } from '@/lib/local-perks';
import type { WayveePromotion } from '@/lib/promotions';

/** One deal card on Discover. Every deal comes from a published record: a
 * venue's own offer, a happy hour on its official facts, or a current partner
 * promotion. Nothing is generated to fill the row. */
export type DiscoverDeal = {
  id: string;
  /** Short badge text ("$2", "HH", "%") or empty when `glyph` is used. */
  badge: string; glyph?: string;
  who: string; what: string;
  tag?: 'Today' | 'Partner';
  /** The venue the deal belongs to, for its photo. Partners have none. */
  entryKey?: string;
  action: { type: 'offer'; offer: LocalOffer } | { type: 'entry'; href: string } | { type: 'url'; url: string };
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** True only when the published wording plainly covers today: "daily", "every
 * day", "weekdays" on Monday–Friday, or today's full weekday name. Abbreviated
 * ranges ("Tue–Thu") are left untagged rather than guessed. */
export function coversToday(wording: string, now: Date): boolean {
  const text = wording.toLowerCase(), day = now.getDay();
  if (/\bdaily\b|every day/.test(text)) return true;
  if (/\bweekdays\b/.test(text) && day >= 1 && day <= 5) return true;
  return new RegExp(`\\b${WEEKDAYS[day]}s?\\b`).test(text);
}

function happyHourWording(entry: HomeGuideEntry): string | undefined {
  const labelled = entry.details.find(detail => /happy[ -]?hour/i.test(detail.label));
  if (labelled) return `Happy hour ${labelled.value}`;
  const part = entry.details.flatMap(detail => detail.value.split(' · ')).find(value => /happy[ -]?hour/i.test(value));
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : undefined;
}

function partner(promotion: WayveePromotion | undefined): DiscoverDeal[] {
  const action = promotion?.actions.find(item => item.primary) || promotion?.actions[0];
  if (!promotion || !action) return [];
  const price = promotion.title.match(/\$\d+/)?.[0];
  const percent = /%/.test(promotion.title + promotion.detail);
  return [{ id: 'partner:' + promotion.id, badge: price || (percent ? '%' : ''), glyph: price || percent ? undefined : promotion.placement === 'discover-rides' ? 'car' : 'tag',
    who: promotion.brand, what: [promotion.title, promotion.detail].join(' · '), tag: 'Partner', action: { type: 'url', url: action.url } }];
}

/** `promotions` are the partner placements the calling screen shows, in order. */
export function discoverDeals(catalog: HomeGuideCatalog, now = new Date(), promotions: readonly (WayveePromotion | undefined)[] = []): DiscoverDeal[] {
  const offers: DiscoverDeal[] = localOffers(catalog, now).map(offer => {
    const copy = compactOffer(offer);
    return { id: 'offer:' + offer.id, badge: copy.title.match(/\$[\d.]+/)?.[0] || '%', who: offer.venue, what: `${copy.title} · ${copy.detail}`, entryKey: offer.venueKey,
      tag: coversToday(offer.label || '', now) ? 'Today' : undefined, action: { type: 'offer', offer } };
  });
  const offered = new Set(offers.map(deal => deal.who));
  const seen = new Set<string>();
  const happyHours: DiscoverDeal[] = Object.values(catalog.entries).filter(entry => hasHappyHour(entry) && !offered.has(entry.name)).flatMap(entry => {
    const wording = happyHourWording(entry);
    if (!wording || seen.has(entry.name)) return [];
    seen.add(entry.name);
    return [{ id: 'happy:' + entry.kind + ':' + entry.id, badge: 'HH', who: entry.name, what: wording, entryKey: homeGuideKey(entry.kind, entry.id), tag: coversToday(wording, now) ? 'Today' as const : undefined,
      action: { type: 'entry' as const, href: homeGuideHref(entry) } }];
  });
  const partners = promotions.flatMap(partner);
  const local = [...offers, ...happyHours];
  return [...local.filter(deal => deal.tag === 'Today'), ...local.filter(deal => deal.tag !== 'Today'), ...partners];
}
