import { RESTAURANTS } from '@/lib/data';
import { CITY_CENTER } from '@/lib/geo';
import { buildNearestPool } from '@/lib/nearest-pool';
import { NEARBY_OAKLAND } from '@/lib/nearby-oakland';

describe('the shared Home / Nearest pool', () => {
  it('populates at least twenty real local places before GPS or backend hydration', () => {
    const pool=buildNearestPool({restaurants:Object.values(RESTAURANTS),places:NEARBY_OAKLAND,center:CITY_CENTER,coordsFor:()=>null,allowCuratedEstimates:true});
    expect(pool.length).toBeGreaterThanOrEqual(20);
    expect(pool.every(x=>x.miles<=5)).toBe(true);
    expect(pool.filter(x=>!x.estimated).length).toBeGreaterThanOrEqual(20);
    expect(pool[0].miles).toBeLessThanOrEqual(pool.at(-1)!.miles);
  });
  it('uses GPS to reorder the same anchor-defined pool, excluding distant candidates', () => {
    const restaurants=Object.values(RESTAURANTS).slice(0,25);
    const points=new Map(restaurants.map((x,i)=>[x.name,{latitude:CITY_CENTER.latitude+(i===24?1:i*.0003),longitude:CITY_CENTER.longitude}]));
    const common={restaurants,places:[],center:CITY_CENTER,coordsFor:(x:{name:string})=>points.get(x.name)||null};
    const initial=buildNearestPool(common);
    const refined=buildNearestPool({...common,device:points.get(restaurants[23].name)});
    expect(initial).toHaveLength(24);
    expect(refined.map(x=>x.id).sort()).toEqual(initial.map(x=>x.id).sort());
    expect(refined[0].id).toBe(restaurants[23].id);
    expect(refined.some(x=>x.id===restaurants[24].id)).toBe(false);
  });
  it('does not reuse Oakland distance estimates for another market', () => {
    expect(buildNearestPool({restaurants:Object.values(RESTAURANTS),places:[],center:{latitude:37.7749,longitude:-122.4194},coordsFor:()=>null})).toEqual([]);
  });
  it('keeps the trip anchor when the browsing device is outside the local service area', () => {
    const common={restaurants:Object.values(RESTAURANTS),places:[],center:CITY_CENTER,coordsFor:()=>null,allowCuratedEstimates:true};
    expect(buildNearestPool({...common,device:{latitude:40.7,longitude:-74}})).toEqual(buildNearestPool(common));
  });
});
