/** @jest-environment node */
import { CollectionLoader,SourceBlocked } from '../collection-loader';
import { DetailSourceCache,SourceBudgetExhausted } from '../detail-source-cache';
import { readMenuSource } from '../menu-source-reader';
const identity={name:'A kitchen',address:'12 Main St'},url='https://venue.example/menu';
const html='<div data-hook="item.root"><h3 data-hook="item.name">Soup</h3><p data-hook="item.price">$12</p></div>';
it('preserves old cached goods but propagates a blocked refresh instead of claiming fresh readiness',async()=>{
 const key=JSON.stringify(['menu-photo-v2',url,identity.name,identity.address]),cache=new DetailSourceCache();
 await cache.read(key,async()=>({status:200,body:html}),()=>({links:[],menuPage:true,content:{version:1,sourceUrl:url,verifiedAt:'2026-10-01T00:00:00Z',menu:{url,items:[{name:'Old soup',categories:[]}]}}}),Date.parse('2026-10-01T00:00:00Z'));
 const loader=new CollectionLoader(20,{resolve:async()=>['8.8.8.8'],delayMs:0,request:async()=>new Response('',{status:403})});
 await expect(readMenuSource(loader,cache,url,identity,true)).rejects.toBeInstanceOf(SourceBlocked);
 const retained=cache.snapshot().records[key];expect(retained.content?.menu?.items[0].name).toBe('Old soup');expect(retained.failures).toBe(1);
 await expect(readMenuSource(loader,cache,url,identity,true)).rejects.toThrow('failure backoff');
});
it('propagates exhausted network budget without making an old cache snapshot a successful refresh',async()=>{
 const cache=new DetailSourceCache(),loader=new CollectionLoader(0,{resolve:async()=>['8.8.8.8'],delayMs:0});
 await expect(readMenuSource(loader,cache,url,identity,true)).rejects.toBeInstanceOf(SourceBudgetExhausted);
});
