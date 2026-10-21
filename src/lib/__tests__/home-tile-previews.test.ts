import { CRAWLS, EVENTS, NIGHTLIFE_SPOTS, RESTAURANTS } from '@/lib/data';
import { buildHomeTilePreviews, usableHomePhoto } from '@/lib/home-tile-previews';
import type { NearestPick } from '@/lib/nearest-pool';

const now = new Date('2026-10-20T15:30:00-07:00');
const empty = {nearest: [], nightlife: [], crawls: [], events: [], now};
const mua = RESTAURANTS.mua;

describe('Home local previews', () => {
  it('keeps the featured photo identity and uses the matching measured distance', () => {
    const pick: NearestPick = {id:mua.id,name:mua.name,cuisine:mua.cuisine,price:mua.price,thumbnailGlyph:'food',href:'/restaurant/mua',miles:.7,estimated:false,distanceLabel:'0.7 mi'};
    const result = buildHomeTilePreviews({...empty,nearest:[pick],featuredRestaurant:mua}).eat;
    expect(result.photoKey).toBe('/restaurant/mua');
    expect(result.facts.map(f=>f.value)).toEqual(['$$','0.7 mi']);
    expect(result.accessibilityDetail).not.toContain('Estimated');
  });
  it('marks curated travel as an estimate instead of implying a phone fix', () => {
    const result = buildHomeTilePreviews({...empty,featuredRestaurant:mua}).eat;
    expect(result.facts[1]).toMatchObject({glyph:'walk',value:'~12 min'});
    expect(result.accessibilityDetail).toContain('Estimated travel: 12 min walk');
  });
  it('does not invent a price when a nearby cafe has none', () => {
    const pick: NearestPick = {id:'cafe',name:'Local cafe',cuisine:'Coffee',thumbnailGlyph:'coffee',href:'/place/cafe',miles:.2,estimated:false,distanceLabel:'0.2 mi'};
    expect(buildHomeTilePreviews({...empty,nearest:[pick]}).eat.facts.map(f=>f.value)).toEqual(['Coffee','0.2 mi']);
  });
  it('uses source hours only when the daily schedule supports the closing label', () => {
    const bird = NIGHTLIFE_SPOTS.find(x=>x.id==='little-bird')!;
    expect(buildHomeTilePreviews({...empty,nightlife:[bird]}).bars.facts[1]).toMatchObject({glyph:'clock',value:'2 AM'});
    const shiru = NIGHTLIFE_SPOTS.find(x=>x.id==='bar-shiru')!;
    expect(buildHomeTilePreviews({...empty,nightlife:[shiru]}).bars.facts[1].glyph).toBe('pin');
  });
  it('reads route stops and length without inventing a walking time', () => {
    expect(buildHomeTilePreviews({...empty,crawls:[CRAWLS.uptown]}).routes.facts.map(f=>f.value)).toEqual(['3 stops','<1 mi']);
    expect(buildHomeTilePreviews({...empty,crawls:[CRAWLS.oldoakland]}).routes.facts.map(f=>f.value)).toEqual(['4 stops','Ride']);
  });
  it('keeps the earliest current event name, image, venue and time together', () => {
    const source=Object.values(EVENTS)[0];
    const expired={...source,id:'expired',name:'Past show',startsAt:'2026-10-19T20:00:00-07:00'};
    const later={...source,id:'later',name:'Later show',startsAt:'2026-10-22T20:00:00-07:00'};
    const first={...source,id:'first',name:'One Two Three Four Five Six Seven',startsAt:'2026-10-20T20:00:00-07:00',time:'8 PM',date:'Tue Oct 20',venue:'Fox Theater',venueId:'fox',image:'https://thefoxoakland.com/artist.jpg'};
    const result=buildHomeTilePreviews({...empty,events:[later,expired,first]}).events;
    expect(result.caption).toBe('One Two Three Four Five… · Fox');
    expect(result.image).toBe(first.image);
    expect(result.facts.map(f=>f.value)).toEqual(['Tonight','8 PM']);
    expect(result.accessibilityDetail).toContain(first.name);
  });
  it('does not fill an empty city with unrelated Oakland picks or photographs', () => {
    const results=buildHomeTilePreviews(empty);
    for(const result of Object.values(results)){
      expect(result.facts.map(f=>f.value)).toEqual(['Check listings']);
      expect(result.image).toBeUndefined();
      expect(result.photoKey).toBeUndefined();
    }
  });
  it('rejects stock stand-ins and unsafe URLs while allowing native photography', () => {
    for(const url of ['https://images.unsplash.com/a','https://www.pexels.com/a','https://cdn.pixabay.com/a','https://upload.wikimedia.org/a','http://merchant.com/a','broken']){
      expect(usableHomePhoto(url)).toBeUndefined();
    }
    expect(usableHomePhoto('https://images.squarespace-cdn.com/merchant.jpg')).toBe('https://images.squarespace-cdn.com/merchant.jpg');
  });
});
