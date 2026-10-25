/** Populate the native detail goods from matched catalog entries and official
 * published menu pages. Public clients read the result; no runtime scraping. */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { RESTAURANTS, FOOD_HUB_REASON_BY_ID } from '../src/lib/data';
import { restaurantForPlace } from '../src/lib/catalog-identity';
import { VERIFIED_MENU_DETAILS } from '../src/lib/verified-menu-details';
import { parseDetailContent, type DetailContent } from '../src/lib/detail-content';
import { restaurantJournalMenu } from '../src/lib/detail-journal';
import { milesBetween } from '../src/lib/geo';
import { extractOfficialMenu, officialMenuLinks } from './lib/menu-schema';
import { serviceClient, withCitySyncRuns } from './lib/sync-run';
import { DetailSourceCache, SourceBudgetExhausted } from './lib/detail-source-cache';

const client=serviceClient('sync official menus');
const fetchLimit=Math.max(0,Math.min(500,Number(process.env.DETAIL_MENU_FETCH_LIMIT||100)||0));
const cachePath=process.env.DETAIL_SOURCE_CACHE_PATH||'.cache/detail-sources-v1.json';
const diskCache=new DetailSourceCache((()=>{try{return JSON.parse(readFileSync(cachePath,'utf8'));}catch{return undefined;}})());
let requests=0;
const sources:Record<string,string>={
  'osm:1186413904':'https://www.goldenlotusvegan.co/menu-1?menu=menu',
  'osm:1186413846':'https://www.highwirecoffee.com/pages/locations/broadway',
  'osm:1629071719':'https://www.brokendreamsoakland.com/',
  'osm:2722259999':'https://www.awakencafe.com/',
  'osm:2306696660':'https://www.bocanovaoakland.com/menu',
};
const blockedIp=(ip:string)=>/^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::|fc|fd|fe80:)/i.test(ip);
async function publicUrl(raw:string):Promise<URL>{
  const url=new URL(raw);if(url.protocol==='http:')url.protocol='https:';
  if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)||!url.hostname.includes('.')||/\.(local|internal|localhost)$/.test(url.hostname))throw new Error('non-public source URL');
  const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(address=>blockedIp(address.address)))throw new Error('non-public source address');
  return url;
}
async function load(raw:string,headers:Record<string,string>){
    if(requests>=fetchLimit)throw new SourceBudgetExhausted();
    let url=await publicUrl(raw);
    for(let redirect=0;redirect<4;redirect++){
      if(requests>=fetchLimit)throw new SourceBudgetExhausted();
      requests++;
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{...headers,'User-Agent':'WayveeMenuSync/1.0 (+https://001-wayvee.vercel.app)','Accept':'text/html'}});
      if(response.status>=300&&response.status<400&&response.headers.get('location')){url=await publicUrl(new URL(response.headers.get('location')!,url).href);continue;}
      const validators={etag:response.headers.get('etag')||undefined,lastModified:response.headers.get('last-modified')||undefined};
      if(response.status===304)return {status:304,...validators};
      if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('source unavailable');
      const reader=response.body?.getReader();if(!reader)throw new Error('empty source');
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8_000_000){await reader.cancel();throw new Error('source page too large');}chunks.push(part.value);}
      return {status:200,body:Buffer.concat(chunks).toString('utf8'),...validators};
    }
    throw new Error('too many redirects');
}

void withCitySyncRuns(client,'menus',async city=>{
  const {data,error}=await client.from('places').select('id,name,address,website,image,lat,lon,needs_review,detail_content').eq('city',city.slug);
  if(error)throw new Error(error.message);
  const places=(data||[]).filter(place=>!place.needs_review).sort((a,b)=>milesBetween(city.anchor,{latitude:a.lat,longitude:a.lon})-milesBetween(city.anchor,{latitude:b.lat,longitude:b.lon}));
  let records=0,written=0,menus=0,items=0,photos=0,index=0;
  const firstRequest=requests,firstStats={...diskCache.stats};
  async function worker(){
    while(index<places.length){
      const place=places[index++],curated=restaurantForPlace(place,Object.values(RESTAURANTS),city.slug);
      const existing=parseDetailContent(place.detail_content);let content:DetailContent|undefined=existing||((city.slug==='oakland')?VERIFIED_MENU_DETAILS[place.id]:undefined);
      if(curated&&!content?.menu?.items.length){
        const menu=restaurantJournalMenu(curated),checked=curated.id==='shootingstar'?'2026-10-25T00:00:00Z':'2026-07-20T00:00:00Z';
        content={version:1,sourceUrl:curated.sourceUrl,verifiedAt:checked,description:curated.id==='shootingstar'?'An all-day Hong Kong café with a late dinner menu.':FOOD_HUB_REASON_BY_ID[curated.id],
          menu:{url:curated.id==='shootingstar'?curated.orderUrl||curated.menuUrl:curated.menuUrl,title:curated.highlightsLabel,verifiedAt:checked,note:menu.note||'Listed menu snapshot. Current pricing and availability are on the official menu.',items:[...menu.items]},offers:[...menu.specials]};
      }
      const raw=sources[place.id]||curated?.menuUrl||place.website?.split(';')[0];
      if(raw){
          const readSource=(url:string)=>diskCache.read(JSON.stringify([city.slug,place.id,place.name,place.address,url]),headers=>load(url,headers),html=>({content:extractOfficialMenu(html,url,place),links:officialMenuLinks(html,url)}));
          const source=await readSource(raw),parsed=source?.content;
          if(parsed)content={...content,...parsed,menu:parsed.menu||content?.menu,offers:parsed.offers?.length?parsed.offers:content?.offers};
          if(!content?.menu?.items.length){
            for(const link of (source?.links||[]).filter(link=>link!==raw).slice(0,2)){
              const linked=(await readSource(link))?.content;if(linked?.menu?.items.length){content={...content,...linked,offers:content?.offers};break;}
            }
          }
      }
      if(!content||(!content.menu?.items.length&&!content.photos?.length))continue;
      content=parseDetailContent(content)!;
      const payload:Record<string,unknown>={detail_content:content};
      if(!place.image&&content.photos?.[0]?.url)payload.image=content.photos[0].url;
      if(JSON.stringify(content)!==JSON.stringify(existing)||payload.image){
        const {error:updateError}=await client.from('places').update(payload).eq('id',place.id).eq('city',city.slug);
        if(updateError)throw new Error('detail update failed: '+updateError.message);
        written++;
      }
      records++;if(content.menu?.items.length){menus++;items+=content.menu.items.length;}photos+=content.photos?.length||0;
    }
  }
  try{await Promise.all(Array.from({length:4},()=>worker()));}
  finally{await mkdir(dirname(cachePath),{recursive:true});await writeFile(cachePath,JSON.stringify(diskCache.snapshot()));}
  const delta=Object.fromEntries(Object.entries(diskCache.stats).map(([key,value])=>[key,value-firstStats[key as keyof typeof firstStats]]));
  const detail=`${records} detail records, ${menus} menus, ${items} dishes, ${photos} photos; ${written} writes, ${requests-firstRequest} HTTP requests, ${delta.cached} cached, ${delta.unchanged} unchanged, ${delta.failed} unavailable`;
  console.log(detail);
  if(!records)throw new Error('No verified detail content could be populated');
  return {status:delta.failed?'partial':'ok',rowsWritten:written,detail};
});
