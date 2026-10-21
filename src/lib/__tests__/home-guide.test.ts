import { BUNDLE_CITY } from '@/lib/city';
import { applyCurationForCity } from '@/lib/curation';
import { CURATED_COLLECTIONS, EVENTS, RESTAURANTS, type CuratedCollection } from '@/lib/data';
import { homeDiscoveryCollections, homeDiscoveryIdea, homeDiscoveryIdeas, timelyHomeCollection } from '@/lib/home-discovery';
import { buildHomeGuide, entriesForHomeCollection, entriesForHomeIdea, filterHomeGuide, homeGuideHref, homeGuideHrefFromLegacy, searchHomeGuide } from '@/lib/home-guide';
import type { NearestPick } from '@/lib/nearest-pool';
import { NEARBY_OAKLAND } from '@/lib/nearby-oakland';

const morning = new Date(2026, 9, 21, 8, 30);
const at = (hour: number) => new Date(2026, 9, 21, hour, 30);
const build = (options: Partial<Parameters<typeof buildHomeGuide>[0]> = {}) => buildHomeGuide({
  city:'oakland', now:morning, nearest:[], places:NEARBY_OAKLAND, events:[], picks:[], ...options,
});
afterEach(() => applyCurationForCity(BUNDLE_CITY));

describe('Home intentions and shortlists', () => {
  it.each([8, 12, 15, 19, 23, 2])('offers exactly three Home-only intentions at %s:30', hour => {
    const ideas=homeDiscoveryIdeas(at(hour));
    expect(ideas).toHaveLength(3);
    expect(new Set(ideas.map(x=>x.id)).size).toBe(3);
    expect(ideas.every(x=>x.href.startsWith('/home/ideas?idea='))).toBe(true);
  });
  it('changes with the guest-local daypart and preserves bookmarked intentions', () => {
    expect(homeDiscoveryIdeas(morning)[0].id).toBe('breakfast');
    expect(homeDiscoveryIdeas(at(19))[0].id).toBe('dinner');
    expect(homeDiscoveryIdeas(at(23))[2].id).toBe('tomorrow');
    expect(homeDiscoveryIdea('late-bites',morning)?.topic).toBe('late-food');
    expect(homeDiscoveryIdea('missing',morning)).toBeUndefined();
    expect(homeDiscoveryCollections(morning).map(x=>x.id)).toContain('morning-plates');
    expect(homeDiscoveryCollections(at(23)).map(x=>x.id)).toEqual(['late-night']);
  });
  it('filters stale, missing and distant-future events, updating the cover without mutating the source', () => {
    const event=Object.values(EVENTS).find(x=>x.startsAt)!;
    const source:CuratedCollection={...CURATED_COLLECTIONS['late-night'],coverImage:'old-cover',items:[{type:'event',id:event.id},{type:'event',id:'missing'}]};
    const start=Date.parse(event.startsAt!);
    expect(timelyHomeCollection(source,new Date(start-86400000))?.coverImage).toBe(event.image);
    expect(timelyHomeCollection(source,new Date(start-8*86400000))).toBeUndefined();
    expect(timelyHomeCollection(source,new Date(start+7*86400000))).toBeUndefined();
    expect(source.coverImage).toBe('old-cover');
    expect(source.items).toHaveLength(2);
  });
});

describe('Home Field Guide isolation and real data', () => {
  it('keeps the counted nearest pool in its existing order, including estimated-distance labels', () => {
    const restaurants=Object.values(RESTAURANTS).slice(0,2);
    const nearest:NearestPick[]=restaurants.map((r,i)=>({id:r.id,name:r.name,cuisine:r.cuisine,price:r.price,thumbnailGlyph:'food',href:`/restaurant/${r.id}`,miles:2-i,estimated:i===0,distanceLabel:i===0?'~2 mi':'1 mi'}));
    const catalog=build({nearest});
    expect(catalog.categories.eat.map(x=>x.id)).toEqual(nearest.map(x=>x.id));
    expect(catalog.categories.eat.map(x=>x.facts.at(-1)?.value)).toEqual(['~2 mi','1 mi']);
    expect(catalog.categories.eat[0].facts.at(-1)?.label).toMatch(/Estimated/);
  });
  it('routes all supported Home records into its own detail and collection layers', () => {
    expect(homeGuideHref({kind:'place',id:'a/b & c'})).toBe('/home/detail?kind=place&id=a%2Fb%20%26%20c');
    expect(homeGuideHref({kind:'collection',id:'late-night'})).toBe('/home/collection?id=late-night');
    expect(homeGuideHrefFromLegacy('/restaurant/mua')).toBe('/home/detail?kind=restaurant&id=mua');
    expect(homeGuideHrefFromLegacy('/place/a%20b')).toBe('/home/detail?kind=place&id=a%20b');
    expect(homeGuideHrefFromLegacy('/create')).toBe('/create');
    for(const entry of Object.values(build().entries))expect(homeGuideHref(entry)).toMatch(/^\/home\//);
  });
  it('scopes curated records and outdoors to the active city', () => {
    const sf=build({city:'san-francisco',places:[]});
    expect(sf.categories.bars).toEqual([]);
    expect(sf.categories.routes).toEqual([]);
    expect(sf.collections).toEqual([]);
    expect(Object.values(sf.entries).map(x=>x.id).sort()).toEqual(['golden-gate-park','lands-end','presidio-trails']);
    expect(entriesForHomeIdea(homeDiscoveryIdea('fresh-air',morning)!,sf).every(x=>x.caption.includes('San Francisco'))).toBe(true);
  });
  it('keeps breakfast and coffee relevant, omitting invented opening and distance claims', () => {
    const catalog=build();
    const coffee=entriesForHomeIdea(homeDiscoveryIdea('coffee',morning)!,catalog);
    expect(coffee.length).toBeGreaterThan(0);
    expect(coffee.every(x=>/coffee|cafe|espresso/.test(x.searchText))).toBe(true);
    const breakfast=entriesForHomeIdea(homeDiscoveryIdea('breakfast',morning)!,catalog);
    expect(breakfast.some(x=>x.id==='brendas')).toBe(true);
    expect(breakfast.some(x=>x.id==='gogi'||x.id==='woodtavern')).toBe(false);
    const outdoors=entriesForHomeIdea(homeDiscoveryIdea('fresh-air',morning)!,catalog);
    expect(outdoors).toHaveLength(3);
    expect(outdoors.every(x=>!x.saveKind&&!x.planKind&&x.links[0].url.startsWith('https://'))).toBe(true);
    expect(outdoors.every(x=>x.facts.every(f=>!f.value.includes(' mi')))).toBe(true);
  });
  it('resolves a bookmarked late-food collection outside its promotion window', () => {
    const catalog=build();
    const expected=entriesForHomeCollection(catalog,'late-night');
    expect(expected.length).toBeGreaterThan(0);
    expect(entriesForHomeIdea(homeDiscoveryIdea('late-bites',morning)!,catalog)).toEqual(expected);
    expect(entriesForHomeCollection(catalog,'missing')).toEqual([]);
    expect(new Set(expected.map(x=>x.kind+':'+x.id)).size).toBe(expected.length);
  });
  it('searches source facts and filters routes without fabricating matches', () => {
    const catalog=build();
    expect(searchHomeGuide(catalog,'mua').some(x=>x.id==='mua')).toBe(true);
    expect(searchHomeGuide(catalog,'completely unknown query')).toEqual([]);
    const walks=filterHomeGuide(catalog.categories.routes,'Walking');
    const rides=filterHomeGuide(catalog.categories.routes,'Rides');
    expect(walks.length+rides.length).toBe(catalog.categories.routes.length);
    expect(rides.every(x=>x.facts.some(f=>f.glyph==='car'))).toBe(true);
  });
  it('omits expired events even when the caller supplies them', () => {
    const event=Object.values(EVENTS).find(x=>x.startsAt)!;
    const catalog=build({events:[event],now:new Date(Date.parse(event.startsAt!)+7*86400000)});
    expect(catalog.categories.events).toEqual([]);
    expect(catalog.entries['event:'+event.id]).toBeUndefined();
  });
});
