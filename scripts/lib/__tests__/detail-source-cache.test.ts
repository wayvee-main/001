/** @jest-environment node */
import { DetailSourceCache, SourceBudgetExhausted } from '../detail-source-cache';

const DAY=86_400_000,now=Date.parse('2026-10-25T12:00:00Z');
const content={version:1 as const,sourceUrl:'https://venue.example/menu',verifiedAt:new Date(now).toISOString(),menu:{url:'https://venue.example/menu',items:[{name:'Soup',price:'$12',categories:['Menu']}]}};
const extract=jest.fn(()=>({content,links:['https://venue.example/menu']}));
beforeEach(()=>extract.mockClear());

it('persists useful fields and skips all network and parsing while fresh',async()=>{
 const cache=new DetailSourceCache(),request=jest.fn(async()=>({status:200,body:'large published page',etag:'v1'}));
 await cache.read('oakland:venue:address:url',request,extract,now);
 const saved=JSON.stringify(cache.snapshot());expect(saved).not.toContain('large published page');
 const restored=new DetailSourceCache(JSON.parse(saved));
 expect((await restored.read('oakland:venue:address:url',request,extract,now+DAY))?.content?.menu?.items[0].price).toBe('$12');
 expect(request).toHaveBeenCalledTimes(1);expect(extract).toHaveBeenCalledTimes(1);expect(restored.stats.cached).toBe(1);
});

it('uses conditional requests and skips parsing both 304s and identical 200 bodies',async()=>{
 const cache=new DetailSourceCache();
 await cache.read('venue',async()=>({status:200,body:'same',etag:'v1',lastModified:'Sun, 25 Oct 2026 12:00:00 GMT'}),extract,now);
 const request=jest.fn(async()=>({status:304}));
 await cache.read('venue',request,extract,now+8*DAY);
 expect(request.mock.calls[0]).toEqual([{'If-None-Match':'v1','If-Modified-Since':'Sun, 25 Oct 2026 12:00:00 GMT'}]);
 await cache.read('venue',async()=>({status:200,body:'same'}),extract,now+16*DAY);
 expect(extract).toHaveBeenCalledTimes(1);expect(cache.stats.unchanged).toBe(2);
});

it('retains prior goods on failure and backs off unavailable sources',async()=>{
 const cache=new DetailSourceCache();
 await cache.read('venue',async()=>({status:200,body:'page'}),extract,now);
 const request=jest.fn(async()=>{throw new Error('timeout');});
 const stale=await cache.read('venue',request,extract,now+8*DAY);
 expect(stale?.content?.menu?.items).toEqual(content.menu.items);
 await cache.read('venue',request,extract,now+8.5*DAY);expect(request).toHaveBeenCalledTimes(1);
 await cache.read('venue',request,extract,now+9*DAY);expect(request).toHaveBeenCalledTimes(2);
 await cache.read('venue',request,extract,now+10*DAY);expect(request).toHaveBeenCalledTimes(2);
});

it('does not penalize unfetched places when the request budget is exhausted',async()=>{
 const cache=new DetailSourceCache();
 await cache.read('later place',async()=>{throw new SourceBudgetExhausted();},extract,now);
 await cache.read('later place',async()=>({status:200,body:'page'}),extract,now+1);
 expect(extract).toHaveBeenCalledTimes(1);expect(cache.stats.failed).toBe(0);
});

it('keeps branch identities separate and reparses changed content',async()=>{
 const cache=new DetailSourceCache();
 await cache.read('city:branchA:streetA:url',async()=>({status:200,body:'a'}),extract,now);
 await cache.read('city:branchB:streetB:url',async()=>({status:200,body:'b'}),extract,now);
 await cache.read('city:branchA:streetA:url',async()=>({status:200,body:'updated'}),extract,now+8*DAY);
 expect(extract).toHaveBeenCalledTimes(3);
});
