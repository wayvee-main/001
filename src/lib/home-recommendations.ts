import { currentDaypart, type Daypart } from '@/lib/daypart';
import { publicDetailUrl, type DetailMenuItem } from '@/lib/detail-content';
import { homeGuideHref, homeGuideKey, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { openStateFor } from '@/lib/hours';
import { compactOffer, localOffers, type LocalOffer } from '@/lib/local-perks';

export const RECOMMENDATION_MAX_AGE_MS = 14 * 86_400_000;
export type HomeRecommendation = {
  id: string; kind: 'venue' | 'dish' | 'offer' | 'event'; label: string;
  venue: string; glyph: string; href: string; verifiedAt: string;
  basis: 'recently-verified' | 'source-popular'; sourceUrl: string; offer?: LocalOffer;
};

const normalized = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const identity = (value: string) => normalized(value).replace(/[^a-z0-9]/g, '');
const fresh = (value: string | undefined, now: Date) => {
  const age = now.getTime() - Date.parse(value || '');
  return Number.isFinite(age) && age >= -300_000 && age <= RECOMMENDATION_MAX_AGE_MS;
};

/** Only explicit daily/weekday schedules are converted. Unknown dated or
 * conditional promotion windows are not promoted as available right now. */
export function promotionIsCurrent(label: string, now: Date): boolean {
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d|\b\d{1,2}\/\d{1,2}\b/i.test(label)) return false;
  const time = label.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!time) return !/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:am|pm)\b|\b(?:until|after|before|from)\s+\d|\b(?:mon|tue|wed|thu|fri|sat|sun)\w*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d|\b\d{1,2}\/\d{1,2}\b/i.test(label);
  const startHour = Number(time[1]), endHour = Number(time[4]);
  if (startHour < 1 || startHour > 12 || endHour < 1 || endHour > 12 || Number(time[2] || 0) > 59 || Number(time[5] || 0) > 59) return false;
  const endMeridian = time[6].toLowerCase();
  const startMeridian = time[3]?.toLowerCase() || (startHour % 12 > endHour % 12 ? endMeridian === 'pm' ? 'am' : 'pm' : endMeridian);
  const clock = (hour: number, minute: string | undefined, meridian: string) => `${String(hour % 12 + (meridian === 'pm' ? 12 : 0)).padStart(2, '0')}:${minute || '00'}`;
  const prefix = label.slice(0, time.index).toLowerCase();
  let days = '';
  if (/daily|every day|everyday/.test(prefix)) days = '';
  else if (/weekdays/.test(prefix)) days = 'Mo-Fr ';
  else if (/weekends/.test(prefix)) days = 'Sa-Su ';
  else {
    const matches = prefix.match(/\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/g);
    if (!matches?.length) return false;
    const names: Record<string, string> = { mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa', sun: 'Su' };
    const tokens = matches.map(day => names[day.slice(0, 3)]);
    days = tokens.join(matches.length === 2 && /[-–—]/.test(prefix) ? '-' : ',') + ' ';
  }
  return openStateFor(days + clock(startHour, time[2], startMeridian) + '-' + clock(endHour, time[5], endMeridian), now).status === 'open';
}

function venueFits(entry: HomeGuideEntry, period: Daypart, now: Date): boolean {
  if (entry.kind === 'collection' || entry.kind === 'crawl' || entry.kind === 'pick') return false;
  const state = openStateFor(entry.openingHours, now).status;
  if (state === 'closed') return false;
  if (entry.kind === 'event') {
    const starts = Date.parse(entry.startsAt || ''), ahead = starts - now.getTime();
    return Number.isFinite(ahead) && ahead >= 0 && ahead <= 48 * 3_600_000 && (period === 'afternoon' || period === 'evening' || ahead < 4 * 3_600_000);
  }
  if (period === 'lateNight') return state === 'open';
  const terms = normalized([entry.foodTags, entry.category, entry.caption].filter(Boolean).join(' '));
  const bar = entry.kind === 'night' || /\b(bar|pub|brewery|night_club|wine_bar)\b/.test(terms);
  if (bar) return period === 'afternoon' || period === 'evening';
  if (period === 'morning' && (entry.kind === 'restaurant' || /restaurant|cafe|bakery/.test(entry.category || ''))) {
    return /\b(coffee|cafe|bakery|breakfast|brunch|bagels?|espresso)\b/.test(terms);
  }
  return true;
}

function dishFits(item: DetailMenuItem, entry: HomeGuideEntry, period: Daypart, now: Date): boolean {
  const categories = normalized(item.categories.join(' '));
  if (/happy[ -]?hour/.test(categories + ' ' + item.name.toLowerCase()) && (!item.note || !promotionIsCurrent(item.note, now))) return false;
  const morning = /breakfast|brunch|pastries|bakery|coffee|tea|espresso/.test(categories);
  const alcohol = /cocktails|wine|beer|spirits/.test(categories);
  if (period === 'morning') return morning && !alcohol;
  if (!venueFits(entry, period, now)) return false;
  if (period === 'midday') return !alcohol && !/dinner.only/.test(categories);
  if (period === 'afternoon') return /small plates|snacks|raw bar|happy.hour|coffee|tea|pastries|desserts|cocktails/.test(categories) || entry.category === 'cafe' || entry.category === 'bakery';
  return !/breakfast|brunch/.test(categories);
}

/** Fresh named records only. Published popular/most-ordered menu categories
 * are a source-backed signal, not a fabricated community trending score. */
export function homeRecommendations(catalog: HomeGuideCatalog, now = new Date()): HomeRecommendation[] {
  const period = currentDaypart(now), candidates: HomeRecommendation[] = [];
  const add = (entry: HomeGuideEntry, item: Omit<HomeRecommendation, 'venue'>) => candidates.push({ ...item, venue: entry.name });
  for (const entry of Object.values(catalog.entries)) {
    const content = entry.detailContent, source = publicDetailUrl(content?.sourceUrl);
    if (!content || !source || openStateFor(entry.openingHours, now).status === 'closed') continue;
    if (fresh(content.verifiedAt, now) && venueFits(entry, period, now)) add(entry, {
      id: 'venue:' + homeGuideKey(entry.kind, entry.id), kind: entry.kind === 'event' ? 'event' : 'venue', label: entry.name,
      glyph: entry.glyph, href: homeGuideHref(entry), verifiedAt: content.verifiedAt, sourceUrl: source, basis: 'recently-verified',
    });
    const menu = content.menu, verified = menu?.verifiedAt || content.verifiedAt;
    if (!menu || !publicDetailUrl(menu.url) || !fresh(verified, now)) continue;
    const popular = (item: DetailMenuItem) => /most ordered|best[ -]?sellers?|popular items|most liked|customer favou?rites/.test(normalized(item.categories.join(' ')));
    const dishes = menu.items.filter(item => item.name.trim() && dishFits(item, entry, period, now)).sort((a, b) => Number(popular(b)) - Number(popular(a))).slice(0, 2);
    for (const item of dishes) add(entry, {
      id: 'dish:' + homeGuideKey(entry.kind, entry.id) + ':' + identity(item.name), kind: 'dish', label: entry.name + ' · ' + item.name,
      glyph: /coffee|espresso|tea/.test(normalized(item.categories.join(' '))) ? 'coffee' : 'food',
      href: homeGuideHref(entry) + '&dish=' + encodeURIComponent(item.name), verifiedAt: verified,
      sourceUrl: publicDetailUrl(item.sourceUrl) || menu.url, basis: popular(item) ? 'source-popular' : 'recently-verified',
    });
  }
  for (const offer of localOffers(catalog, now)) {
    const entry = catalog.entries[offer.venueKey];
    if (!entry || !fresh(offer.verifiedAt, now) || !venueFits(entry, period, now) || !promotionIsCurrent(offer.label, now)) continue;
    add(entry, { id: 'offer:' + offer.id, kind: 'offer', label: entry.name + ' · ' + compactOffer(offer).title, glyph: 'tag', href: offer.href,
      verifiedAt: offer.verifiedAt!, sourceUrl: offer.url, basis: 'recently-verified', offer });
  }
  const priority = { offer: 0, dish: 1, event: 2, venue: 3 };
  candidates.sort((a, b) => Number(b.basis === 'source-popular') - Number(a.basis === 'source-popular')
    || Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt) || priority[a.kind] - priority[b.kind]);
  const result: HomeRecommendation[] = [], used = new Set<string>(), counts = new Map<string, number>();
  for (const perVenue of [1, 2]) for (const item of candidates) {
    const venue = identity(item.venue), key = item.kind + ':' + identity(item.label);
    if (used.has(key) || (counts.get(venue) || 0) >= perVenue) continue;
    result.push(item); used.add(key); counts.set(venue, (counts.get(venue) || 0) + 1);
    if (result.length === 4) return result;
  }
  return result;
}

export function bannerPageForId(ids: readonly string[], selectedId?: string): number {
  return Math.max(0, ids.indexOf(selectedId || ids[0]));
}
