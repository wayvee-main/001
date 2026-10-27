import { CRAWLS, CURATED_COLLECTIONS, FOOD_HUB_REASON_BY_ID, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES, eventDayGroupLabel, isCurrentEvent, type CuratedCollection, type ScoperEvent } from '@/lib/data';
import { homeCollectionGlyph, homeDiscoveryCollections, timelyHomeCollection, type HomeIdea } from '@/lib/home-discovery';
import { HOME_OUTDOORS } from '@/lib/home-outdoors';
import { HOME_GUIDE_PHOTOS } from '@/lib/home-guide-photos';
import { usableHomePhoto } from '@/lib/home-tile-previews';
import type { NearestPick } from '@/lib/nearest-pool';
import type { SearchCandidate } from '@/lib/search';
import type { Place } from '@/lib/places';
import type { PlanKind, SavedPlaceKind } from '@/lib/user-data';
import type { ViatorPick } from '@/lib/viator';
import { hoursSummary } from '@/lib/hours';
import { placeForRestaurant, placeForListing } from '@/lib/catalog-identity';
import type { DetailContent } from '@/lib/detail-content';
import { formatMiles, milesBetween, type GeoPoint } from '@/lib/geo';
import { currentDaypart } from '@/lib/daypart';

export type HomeGuideKind = 'restaurant' | 'place' | 'night' | 'crawl' | 'event' | 'venue' | 'pick' | 'outdoor' | 'collection';
export type HomeGuideCategory = 'eat' | 'bars' | 'routes' | 'events';
export type HomeGuideFact = { glyph: string; value: string; label?: string };
export type HomeGuideEntry = {
  city?:string;
  detailContent?:DetailContent;
  kind: HomeGuideKind; id: string; name: string; caption: string; description: string;
  glyph: string; image?: string; facts: HomeGuideFact[]; searchText: string; category?: string; foodTags?: string; tags?: string[];
  members?: {kind:Exclude<HomeGuideKind,'collection'>; id: string}[];
  details: {label: string; value: string}[];
  sections?: {title: string; lines: string[]}[];
  links: {label: string; url: string}[];
  saveKind?: SavedPlaceKind; planKind?: PlanKind;
};
export type HomeGuideCatalog = {
  entries: Record<string, HomeGuideEntry>;
  categories: Record<HomeGuideCategory, HomeGuideEntry[]>;
  collections: (Omit<CuratedCollection,'id'|'items'> & {id:string;items:{type:Exclude<HomeGuideKind,'collection'>;id:string;note?:string}[]})[];
};

export const homeGuideKey = (kind: string, id: string) => kind + ':' + id;
export const homeGuideHref = (entry: Pick<HomeGuideEntry, 'kind' | 'id'>) => entry.kind === 'collection'
  ? '/home/collection?id=' + encodeURIComponent(entry.id)
  : '/home/detail?kind=' + entry.kind + '&id=' + encodeURIComponent(entry.id);

export function homeGuideHrefFromLegacy(href: string): string {
  const match = href.match(/^\/(restaurant|place|night|crawl|event|venue|pick)\/([^/?#]+)/);
  return match ? homeGuideHref({kind:match[1] as HomeGuideKind,id:decodeURIComponent(match[2])}) : href;
}

const normalized = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const knownLink = (url?: string): url is string => Boolean(url && /^https?:\/\//i.test(url));
function links(...items: ({label: string; url?: string} | undefined)[]): {label: string; url: string}[] {
  const seen = new Set<string>();
  return items.flatMap(item => {
    if (!item || !knownLink(item.url) || seen.has(item.url)) return [];
    seen.add(item.url); return [{label:item.label,url:item.url}];
  });
}
const directions = (name: string, city: string, address?: string | null) => ({label:'Directions',url:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address || name+', '+city.replace(/-/g,' '))});
const compactVenue = (name: string) => /\bfox theater\b/i.test(name) ? 'Fox Theater' : /\bparamount\b/i.test(name) ? 'Paramount' : name;

/** Home's own view models. No Discover component, source record or shared style is modified. */
export function buildHomeGuide({city,nearest,places,events,picks,now,anchor,includeOakland=true,locationBased=false}: {
  city: string; nearest: readonly NearestPick[]; places: readonly Place[];
  events: readonly ScoperEvent[]; picks: readonly ViatorPick[]; now: Date;
  anchor?:GeoPoint|null;includeOakland?:boolean;locationBased?:boolean;
}): HomeGuideCatalog {
  const local = city === 'oakland'&&includeOakland, entries: Record<string, HomeGuideEntry> = {};
  const add = (entry: HomeGuideEntry) => {
    const key=homeGuideKey(entry.kind,entry.id);
    const menuText=entry.detailContent?.menu?.items.map(item=>[item.name,item.desc,...item.categories].filter(Boolean).join(' ')).join(' ')||'';
    entries[key] = {...entry,image:usableHomePhoto(entry.image) || HOME_GUIDE_PHOTOS[key]?.image,searchText:normalized(entry.name+' '+entry.caption+' '+entry.searchText+' '+menuText)};
  };
  if (local) for (const r of Object.values(RESTAURANTS)) {
    const matched=placeForRestaurant(r,places,city);
    if(locationBased&&!matched)continue;
    add({
    detailContent:matched?.detailContent,kind:'restaurant',id:r.id,name:r.name,caption:r.cuisine,description:FOOD_HUB_REASON_BY_ID[r.id] || r.cuisine,
    image:r.image,glyph:'food',facts:[{glyph:'wallet',value:r.price},{glyph:'food',value:r.cuisine}],
    foodTags:normalized([r.name,r.cuisine,...(r.searchTags||[])].join(' ')),
    searchText:[r.cuisine,...(r.searchTags||[]),...r.popularDishes.map(x=>x.name)].join(' '),
    details:[{label:'Address',value:r.address},...r.detailFacts],
    sections:r.menuHighlights.length?[{title:r.highlightsLabel || 'Menu highlights',lines:r.menuHighlights.slice(0,8).map(x=>[x.name,x.price,x.desc].filter(Boolean).join(' · '))}]:[],
    links:links({label:r.primaryAction.label,url:r.primaryAction.url},{label:'Menu',url:r.menuUrl},r.reserveUrl?{label:'Reservations',url:r.reserveUrl}:undefined,{label:'Official site',url:r.sourceUrl},directions(r.name,city,r.address)),saveKind:'restaurant',
  });}
  for (const p of places.filter(item=>!item.needsReview)) add({
    city:p.city,detailContent:p.detailContent,kind:'place',id:p.id,name:p.name,caption:[p.cuisine,p.category.replace(/_/g,' ')].filter(Boolean).join(' · '),
    description:p.detailContent?.description||[p.cuisine,p.category.replace(/_/g,' ')].filter(Boolean).join(' · '),image:p.image||p.detailContent?.photos?.[0]?.url,
    glyph:/cafe|bakery/.test(p.category)?'coffee':/park|reserve|garden|trailhead|viewpoint/.test(p.category)?'walk':/theatre|cinema|museum|gallery|venue|arts_centre|attraction/.test(p.category)?'landmark':/bar|pub|brewery/.test(p.category)?'drink':'food',category:p.category,facts:[{glyph:'pin',value:anchor?formatMiles(milesBetween(anchor,{latitude:p.lat,longitude:p.lon})):p.address?.split(',')[0] || p.category.replace(/_/g,' ')}],
    foodTags:normalized([p.name,p.category,p.cuisine].filter(Boolean).join(' ')),
    searchText:[p.category,p.cuisine,p.address,p.category==='cafe'?'coffee espresso':''].filter(Boolean).join(' '),
    details:[p.address?{label:'Address',value:p.address}:null,p.openingHours?{label:'Listed hours',value:hoursSummary(p.openingHours)||p.openingHours}:null,p.phone?{label:'Phone',value:p.phone}:null,p.sourceLicense?{label:'Map data',value:p.sourceLicense}:null].filter((x):x is {label:string;value:string}=>!!x),
    links:links(p.website?{label:'Official site',url:p.website}:undefined,p.sourceUrl?{label:'Map data source',url:p.sourceUrl}:undefined,directions(p.name,p.city||city,p.address)),saveKind:'place',
  });
  // The exact same measured/estimated pool supplies both Eat's count and its list.
  const eat = nearest.flatMap(pick=>{
    const kind = pick.href.startsWith('/restaurant/')?'restaurant':'place';
    const entry = entries[homeGuideKey(kind,pick.id)];
    if (!entry) return [];
    const updated = {...entry,image:usableHomePhoto(pick.image) || entry.image,facts:[
      ...(pick.price?[{glyph:'wallet',value:pick.price}]:[{glyph:pick.thumbnailGlyph,value:pick.cuisine}]),
      {glyph:'pin',value:pick.distanceLabel,label:(pick.estimated?'Estimated distance: ':'Distance: ')+pick.distanceLabel},
    ]};
    entries[homeGuideKey(kind,pick.id)] = updated; return [updated];
  });
  const bars: HomeGuideEntry[] = [], routes: HomeGuideEntry[] = [], shows: HomeGuideEntry[] = [];
  if (local) for (const bar of NIGHTLIFE_SPOTS) {
    if(locationBased&&!placeForListing(bar,places,city))continue;
    add({detailContent:placeForListing(bar,places,city)?.detailContent,kind:'night',id:bar.id,name:bar.name,caption:bar.kind,description:bar.desc,image:bar.image,glyph:'drink',
      facts:[{glyph:'pin',value:bar.address.split(',')[0]},{glyph:'clock',value:bar.hours}],searchText:bar.kind+' '+bar.desc,
      details:[{label:'Address',value:bar.address},{label:'Listed hours',value:bar.hours}],links:links({label:'Official site',url:bar.url},directions(bar.name,city,bar.address)),saveKind:'night'});
    bars.push(entries[homeGuideKey('night',bar.id)]);
  }
  if (local) for (const route of Object.values(CRAWLS)) {
    const ride=/ride/i.test(route.meta),distance=route.meta.match(/(?:under\s+|[<~]\s*)?\d+(?:\.\d+)?\s*mi\b/i)?.[0];
    add({kind:'crawl',id:route.id,name:route.name,caption:route.meta,description:route.desc,glyph:'route',
      facts:[{glyph:'route',value:route.stops.length+' stops'},...(ride?[{glyph:'car',value:'Rides'}]:distance?[{glyph:'walk',value:distance}]:[])],
      searchText:route.desc+' '+route.meta,details:[],sections:[{title:'Along the way',lines:route.stops.map((stop,i)=>(i+1)+'. '+stop.name+' · '+stop.note)}],
      links:links({label:'Open the route',url:route.routeUrl}),planKind:'crawl'});
    routes.push(entries[homeGuideKey('crawl',route.id)]);
  }
  for (const event of events.filter(item=>isCurrentEvent(item,now))) {
    add({detailContent:event.detailContent,kind:'event',id:event.id,name:event.name,caption:compactVenue(event.venue),description:event.know,image:event.image,glyph:'ticket',
      facts:[{glyph:'calendar',value:eventDayGroupLabel(event,now),label:event.date},{glyph:'clock',value:event.time}],searchText:event.venue+' '+event.lineup+' '+event.cats.join(' '),tags:[...event.cats],
      details:[{label:'When',value:event.date},{label:'Showtime',value:event.time},{label:'Venue',value:event.venue},...(event.addr?[{label:'Address',value:event.addr}]:[]),{label:'Tickets',value:event.priceLabel}],
      sections:event.runOfShow?.length?[{title:'Run of show',lines:event.runOfShow.map(x=>x.time+' · '+x.label)}]:[],
      links:links(event.ticketUrl?{label:'Official tickets',url:event.ticketUrl}:undefined,{label:'Official listing',url:event.sourceUrl},directions(event.venue,city,event.addr)),planKind:'event'});
    shows.push(entries[homeGuideKey('event',event.id)]);
  }
  if (local) for (const venue of Object.values(VENUES)) add({
    kind:'venue',id:venue.id,name:venue.name,caption:venue.sub1,description:venue.sub1,image:venue.image,glyph:'landmark',
    facts:[{glyph:'pin',value:venue.address.split(',')[0]}],searchText:venue.detailMeta,details:[{label:'Address',value:venue.address},...venue.detailFacts],
    links:links({label:'Official site',url:venue.sourceUrl},directions(venue.name,city,venue.address)),saveKind:'venue',
  });
  for (const pick of picks) add({
    kind:'pick',id:pick.id,name:pick.title,caption:pick.destination,description:pick.description,image:pick.image,glyph:'compass',
    facts:[...(pick.durationLabel?[{glyph:'clock',value:pick.durationLabel}]:[]),...(pick.priceFrom!=null&&pick.currency?[{glyph:'wallet',value:'From '+pick.currency+' '+pick.priceFrom}]:[])].slice(0,2),
    searchText:pick.description+' '+pick.flags.join(' '),details:[{label:'Destination',value:pick.destination}],
    sections:pick.inclusions.length?[{title:'Included',lines:pick.inclusions}]:[],links:links({label:'View experience',url:pick.bookingUrl}),planKind:'pick',
  });
  for (const park of HOME_OUTDOORS.filter(item=>item.city===city&&(item.city!=='oakland'||includeOakland))) add({
    kind:'outdoor',id:park.id,name:park.name,caption:park.caption,description:park.description,glyph:park.glyph,
    facts:[{glyph:park.glyph,value:park.caption.split(' · ')[0]},{glyph:'pin',value:park.caption.split(' · ')[1]}],
    searchText:'outdoors hiking trails parks walking '+park.caption,details:[{label:'Before you go',value:'Use the official park page for current access, closures and trail conditions.'}],
    links:links({label:'Park information & updates',url:park.source},directions(park.name,city)),
  });
  if (local) for (const collection of Object.values(CURATED_COLLECTIONS)) {
    const current=timelyHomeCollection(collection,now);if(!current)continue;
    const image=usableHomePhoto(current.coverImage) || current.items.map(item=>entries[homeGuideKey(item.type,item.id)]?.image).find(Boolean);
    add({kind:'collection',id:current.id,name:current.title,caption:current.subtitle,description:current.description,image,glyph:homeCollectionGlyph(current.id),
      facts:[{glyph:'compass',value:current.items.length+' picks'}],searchText:current.eyebrow+' '+current.description,details:[],links:[],members:current.items.map(item=>({kind:item.type,id:item.id}))});
  }
  const matchedBarIds=new Set(local?NIGHTLIFE_SPOTS.flatMap(bar=>{const match=placeForListing(bar,places,city);return match?[match.id]:[];}):[]);
  for(const place of places.filter(place=>!place.needsReview)){
    const entry=entries[homeGuideKey('place',place.id)];if(!entry)continue;
    if(['bar','pub','wine_bar','brewery','night_club'].includes(place.category)&&!matchedBarIds.has(place.id))bars.push(entry);
    if(['park','nature_reserve','garden','trailhead','viewpoint'].includes(place.category))routes.push(entry);
    if(['theatre','cinema','arts_centre','events_venue','music_venue','museum','gallery'].includes(place.category))shows.push(entry);
  }
  const collections:HomeGuideCatalog['collections']=local?homeDiscoveryCollections(now).map(collection=>({...collection,coverImage:entries[homeGuideKey('collection',collection.id)]?.image || ''})):[];
  // A3's mixed collection is an actual, location-scoped door. Its members are
  // current source records, not the mockup's fixed establishments or dates.
  const morning=['morning','midday'].includes(currentDaypart(now));
  const candidates=Object.values(entries);
  const foodPool=morning?candidates.filter(entry=>entry.kind==='place'&&['cafe','bakery'].includes(entry.category||'')):eat;
  const food=foodPool.find(entry=>entry.detailContent?.menu?.items.some(item=>item.image))||foodPool.find(entry=>entry.image)||foodPool[0];
  const horizon=now.getTime()+7*86400000;
  const soon=events.filter(event=>event.startsAt&&isCurrentEvent(event,now)&&Date.parse(event.startsAt)>=now.getTime()&&Date.parse(event.startsAt)<=horizon).sort((a,b)=>Date.parse(a.startsAt!)-Date.parse(b.startsAt!));
  const culturePool=[...soon.flatMap(event=>{const entry=entries[homeGuideKey('event',event.id)];return entry?[entry]:[];}),...shows.filter(entry=>entry.kind==='place'&&['theatre','arts_centre','music_venue','events_venue','museum','gallery'].includes(entry.category||'')),...candidates.filter(entry=>entry.kind==='venue')];
  const culture=culturePool[0];
  const walks=candidates.filter(entry=>entry.kind==='outdoor'||['park','nature_reserve','garden','trailhead','viewpoint'].includes(entry.category||''));
  const wander=walks.find(entry=>/lake|downtown/i.test(entry.name))||walks[0];
  const cover=food?.image||food?.detailContent?.photos?.[0]?.url||culture?.image||wander?.image;
  if(food&&culture&&wander&&cover){
    const unique=(pool:HomeGuideEntry[])=>pool.filter((entry,index)=>pool.findIndex(other=>other.kind===entry.kind&&other.id===entry.id)===index);
    const members=[...unique([food,...foodPool]).slice(0,3),...unique(culturePool).slice(0,2),...unique([wander,...walks]).slice(0,3)].map(entry=>({kind:entry.kind as Exclude<HomeGuideKind,'collection'>,id:entry.id}));
    const mixed={id:'a-little-of-everything',title:'A little of everything',shortTitle:'A little of everything',eyebrow:'Nearby collection',subtitle:morning?'A table · culture · fresh air':'A table · culture · a little wandering',description:'Three local chapters to dip into.',coverImage:cover,
      items:members.map(member=>({type:member.kind,id:member.id})),sourceNote:'Built from current nearby listings; each place retains its own source details.'};
    add({kind:'collection',id:mixed.id,name:mixed.title,caption:mixed.subtitle,description:mixed.description,image:cover,glyph:'compass',facts:[{glyph:'compass',value:members.length+' picks'}],searchText:mixed.subtitle,details:[],links:[],members});
    collections.unshift(mixed);
  }
  return {entries,categories:{eat,bars,routes,events:shows},collections};
}

export function searchHomeGuide(catalog: HomeGuideCatalog, query: string, pool: readonly HomeGuideEntry[] = Object.values(catalog.entries)): HomeGuideEntry[] {
  const tokens=normalized(query).trim().split(/\s+/).filter(Boolean),seen=new Set<string>();
  return pool.filter(entry=>{
    if(tokens.some(token=>!entry.searchText.includes(token)))return false;
    const name=normalized(entry.name);if(seen.has(name))return false;seen.add(name);return true;
  });
}

/** The shared ranked matcher over the active city's Field Guide, including
 * its outdoor ideas. No curated records from another city enter this index. */
export function buildHomeSearchIndex(catalog: HomeGuideCatalog): SearchCandidate[] {
  return Object.values(catalog.entries).map(entry=>({
    kind:entry.kind==='outdoor'?'place':entry.kind,id:entry.id,title:entry.name,
    subtitle:entry.caption,image:entry.image,href:homeGuideHref(entry),
    fields:[{text:entry.name,weight:10},{text:entry.caption,weight:6},{text:entry.searchText,weight:4}],
  }));
}

export function entriesForHomeIdea(idea: HomeIdea, catalog: HomeGuideCatalog): HomeGuideEntry[] {
  if(idea.topic==='events')return catalog.categories.events;
  if(idea.topic==='bars')return catalog.categories.bars;
  if(idea.topic==='outdoors')return Object.values(catalog.entries).filter(x=>x.kind==='outdoor'||['park','nature_reserve','garden','trailhead','viewpoint'].includes(x.category||''));
  if(idea.topic==='late-food'){
    return entriesForHomeCollection(catalog,'late-night');
  }
  const food=Object.values(catalog.entries).filter(x=>x.kind==='restaurant'||(x.kind==='place'&&['restaurant','cafe','bakery'].includes(x.category || '')));
  // A savory pancake or a pastrami sandwich is not evidence of breakfast.
  // Use explicit venue categories/tags, not words from unrelated menu dishes.
  if(idea.topic==='tomorrow'||idea.query==='breakfast')return food.filter(x=>/\b(breakfast|brunch|bakery|bagels?|donuts?|cafe|coffee|espresso)\b/.test(x.foodTags || ''));
  if(idea.query==='coffee')return food.filter(x=>/\b(coffee|cafe|espresso)\b/.test(x.foodTags || ''));
  if(idea.query==='lunch')return food.filter(x=>/lunch|sandwich|salad|burger|pizza|taco|deli/.test(x.searchText));
  return food.filter(x=>x.kind==='restaurant'||x.category==='restaurant');
}

export function entriesForHomeCollection(catalog: HomeGuideCatalog, id: string): HomeGuideEntry[] {
  return (catalog.entries[homeGuideKey('collection',id)]?.members || []).flatMap(item=>{
    const entry=catalog.entries[homeGuideKey(item.kind,item.id)];return entry?[entry]:[];
  });
}

export function filterHomeGuide(entries: readonly HomeGuideEntry[], filter: string): HomeGuideEntry[] {
  if(filter==='Quick bites')return entries.filter(x=>/coffee|cafe|bakery|sandwich|burger|pizza|taco|deli/.test(x.searchText));
  if(filter==='A good table')return entries.filter(x=>x.kind==='restaurant'||/restaurant/.test(x.searchText));
  if(filter==='Listening rooms')return entries.filter(x=>/hi-fi|listening|vinyl/.test(x.searchText));
  if(filter==='Walking')return entries.filter(x=>!x.facts.some(f=>f.glyph==='car'));
  if(filter==='Rides')return entries.filter(x=>x.facts.some(f=>f.glyph==='car'));
  return [...entries];
}

/** Representative photo from this idea's own local results. An empty city's
 * pool never borrows another city's image; titles remain suggestion-led. */
export function homeIdeaPhoto(idea: HomeIdea, catalog: HomeGuideCatalog): string | undefined {
  return entriesForHomeIdea(idea,catalog).find(entry=>entry.image)?.image;
}
