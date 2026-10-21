import { eventDayGroupLabel, isCurrentEvent, type Crawl, type NightlifeSpot, type Restaurant, type ScoperEvent } from '@/lib/data';
import type { NearestPick } from '@/lib/nearest-pool';

export type HomeTileKey = 'eat' | 'bars' | 'routes' | 'events';
export type HomeTileFact = { glyph: string; value: string; label?: string };
export type HomeTilePreview = {
  caption: string;
  facts: HomeTileFact[];
  accessibilityDetail: string;
  photoKey?: string;
  image?: string | number;
  imageLabel?: string;
};

/** Actual catalog photos only; never substitute a generic stock dish or scene. */
export function usableHomePhoto(image?: string): string | undefined {
  if (!image) return undefined;
  try {
    const url = new URL(image);
    if (url.protocol !== 'https:') return undefined;
    if (['unsplash.com', 'pexels.com', 'pixabay.com', 'wikimedia.org'].some(host => url.hostname === host || url.hostname.endsWith('.' + host))) return undefined;
    return image;
  } catch { return undefined; }
}

function empty(caption: string): HomeTilePreview {
  return { caption, facts: [{ glyph: 'calendar', value: 'Check listings' }], accessibilityDetail: caption };
}

function shortName(name: string): string {
  const base = name.split(/:\s+|\s+-\s+|\s+w\/\s+/)[0].trim();
  const words = base.split(/\s+/);
  return words.length > 5 ? words.slice(0, 5).join(' ') + '…' : base;
}

function barKind(kind: string): string {
  if (/hi-fi|listening/i.test(kind)) return 'Hi-fi';
  if (/live music/i.test(kind)) return 'Live music';
  if (/cocktail/i.test(kind)) return 'Cocktails';
  if (/beer|brewery|taproom/i.test(kind)) return 'Beer';
  if (/sports/i.test(kind)) return 'Sports';
  if (/\bDJ/i.test(kind)) return 'DJs';
  return kind.split(/[·+&,]/)[0].trim();
}

/** Two real metadata rows per category. Callers pass only the active city's pools. */
export function buildHomeTilePreviews({ nearest, featuredRestaurant, nightlife, crawls, events, now }: {
  nearest: readonly NearestPick[];
  featuredRestaurant?: Restaurant;
  nightlife: readonly NightlifeSpot[];
  crawls: readonly Crawl[];
  events: readonly ScoperEvent[];
  now: Date;
}): Record<HomeTileKey, HomeTilePreview> {
  const previews: Record<HomeTileKey, HomeTilePreview> = {
    eat: empty('No nearby places yet'),
    bars: empty('No local bars yet'),
    routes: empty('No local routes yet'),
    events: empty('No current shows'),
  };
  const food = featuredRestaurant ?? nearest[0];
  if (food) {
    const matched = nearest.find(pick => pick.id === food.id);
    const estimated = matched ? matched.estimated : Boolean(featuredRestaurant);
    const rawDistance = matched?.distanceLabel ?? food.distanceLabel;
    const distance = estimated && !rawDistance.startsWith('~') ? '~' + rawDistance : rawDistance;
    const travelGlyph = /ride/i.test(distance) ? 'car' : /walk/i.test(distance) ? 'walk' : 'pin';
    const facts: HomeTileFact[] = [];
    if (food.price) facts.push({ glyph: 'wallet', value: food.price, label: 'Price level ' + food.price });
    else if (food.cuisine) facts.push({ glyph: 'food', value: food.cuisine });
    if (distance) facts.push({ glyph: travelGlyph, value: distance.replace(/\s+(?:walk|ride)$/i, ''), label: (estimated ? 'Estimated travel: ' : 'Travel: ') + rawDistance });
    const href = featuredRestaurant ? '/restaurant/' + food.id : nearest[0].href;
    previews.eat = {
      caption: food.name, facts, photoKey: href,
      image: usableHomePhoto(food.image), imageLabel: food.name,
      accessibilityDetail: food.name + '. ' + facts.map(f => f.label ?? f.value).join('. '),
    };
  }
  const bar = nightlife.find(spot => spot.id === 'little-bird') ?? nightlife[0];
  if (bar) {
    const closing = bar.hours.match(/^Daily\s*[·:]?\s*\d+(?::\d+)?\s*(?:AM|PM)\s*[–-]\s*(\d+(?::\d+)?\s*(?:AM|PM))\s*$/i)?.[1];
    const street = bar.address.split(',')[0].replace(/^\d+\s+/, '').replace(/\s+(?:Ave|Avenue|St|Street|Blvd|Road|Rd)\.?$/i, '');
    const facts: HomeTileFact[] = [{ glyph: 'drink', value: barKind(bar.kind) }];
    if (closing) facts.push({ glyph: 'clock', value: closing, label: 'Listed hours: ' + bar.hours });
    else if (street) facts.push({ glyph: 'pin', value: street, label: bar.address });
    previews.bars = {
      caption: bar.name, facts, photoKey: '/night/' + bar.id,
      image: usableHomePhoto(bar.image), imageLabel: bar.name,
      accessibilityDetail: bar.name + '. ' + bar.kind + '. ' + bar.hours,
    };
  }
  const route = crawls.find(crawl => crawl.id === 'uptown') ?? crawls[0];
  if (route) {
    const ride = /ride/i.test(route.meta);
    const miles = route.meta.match(/(?:under\s+|[<~]\s*)?\d+(?:\.\d+)?\s*mi\b/i)?.[0];
    const facts: HomeTileFact[] = [{ glyph: 'route', value: route.stops.length + ' stops' }];
    if (ride) facts.push({ glyph: 'car', value: 'Ride', label: route.meta });
    else if (miles) facts.push({ glyph: 'walk', value: miles.replace(/^under\s+/i, '<'), label: route.meta });
    previews.routes = {
      caption: route.name, facts, photoKey: '/crawl/' + route.id,
      accessibilityDetail: route.name + '. ' + route.meta,
    };
  }
  const event = events.filter(show => isCurrentEvent(show, now))
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))[0];
  if (event) {
    const day = eventDayGroupLabel(event, now);
    const venue = event.venueId === 'fox' ? 'Fox' : event.venueId === 'paramount' ? 'Paramount' : event.venue;
    previews.events = {
      caption: shortName(event.name) + ' · ' + venue,
      facts: [{ glyph: 'calendar', value: day, label: event.date }, { glyph: 'clock', value: event.time }],
      photoKey: '/event/' + event.id, image: usableHomePhoto(event.image),
      imageLabel: event.name + ' at ' + event.venue,
      accessibilityDetail: event.name + '. ' + event.venue + '. ' + event.date + '. ' + event.time,
    };
  }
  return previews;
}
