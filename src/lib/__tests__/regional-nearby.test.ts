import { CITY_CENTER } from '@/lib/geo';
import { isRegionalPoint, mergeNearbyPlaces } from '@/lib/regional-nearby';
import type { Place } from '@/lib/places';
import { buildHomeGuide } from '@/lib/home-guide';
import { homeEntryCategory, homeEntryMetadata } from '@/lib/home-secondary';

const sf={latitude:37.7749,longitude:-122.4194};
const place=(id:string,lat=sf.latitude,lon=sf.longitude,category='restaurant'):Place=>({id,name:id,category,cuisine:null,address:null,lat,lon,website:null,phone:null,image:null,openingHours:null,confidence:'osm_only',needsReview:false});

it('filters before display around the phone, keeping the stored Bay pool broad',()=>{
 const oakland=place('oakland',CITY_CENTER.latitude,CITY_CENTER.longitude),nearby=place('sf'),outside=place('ny',40.7128,-74.006);
 expect(mergeNearbyPlaces([oakland],[outside,nearby],sf).map(row=>row.id)).toEqual(['sf']);
 expect(mergeNearbyPlaces([oakland],[nearby],CITY_CENTER).map(row=>row.id)).toEqual(['oakland']);
 expect(mergeNearbyPlaces([],[{...nearby,needsReview:true}],sf)).toEqual([]);
});

it('preserves verified goods and imagery when a fresh identity has no enrichment',()=>{
 const content={version:1 as const,sourceUrl:'https://venue.example/menu',verifiedAt:'2026-10-25T12:00:00Z',menu:{url:'https://venue.example/menu',items:[{name:'Soup',price:'$12',categories:['Menu']}]}};
 const known={...place('same'),image:'https://venue.example/photo.jpg',detailContent:content};
 const merged=mergeNearbyPlaces([known],[place('same')],sf);
 expect(merged).toHaveLength(1);expect(merged[0].detailContent?.menu?.items[0].price).toBe('$12');expect(merged[0].image).toBe(known.image);
});

it('supports northern Bay locations beyond the old Oakland commute circle',()=>{
 expect(isRegionalPoint({latitude:38.7,longitude:-123.1})).toBe(true);
 expect(isRegionalPoint(sf)).toBe(true);expect(isRegionalPoint({latitude:40.7,longitude:-74})).toBe(false);
 expect(isRegionalPoint({latitude:NaN,longitude:-122})).toBe(false);
});

it('uses SF source parks, bars and venues without leaking curated Oakland or inventing show dates',()=>{
 const places=[place('sf-food'),place('sf-bar',sf.latitude,sf.longitude,'bar'),place('sf-park',sf.latitude,sf.longitude,'park'),place('sf-stage',sf.latitude,sf.longitude,'theatre')];
 const catalog=buildHomeGuide({city:'oakland',places,nearest:[],events:[],picks:[],now:new Date('2026-10-25'),includeOakland:false,locationBased:true,anchor:sf});
 expect(Object.values(catalog.entries).every(entry=>entry.id.startsWith('sf-'))).toBe(true);
 expect(catalog.categories.bars.map(entry=>entry.id)).toEqual(['sf-bar']);expect(catalog.categories.routes.map(entry=>entry.id)).toEqual(['sf-park']);
 const venue=catalog.categories.events[0];expect(venue.kind).toBe('place');expect(homeEntryCategory(venue)).toBe('events');
 expect(homeEntryMetadata(venue).glyph).toBe('landmark');expect(homeEntryMetadata(venue).primary).toBe('theatre');expect(catalog.collections).toEqual([]);
});
