/** Populate the native detail goods from matched catalog entries and official
 * published menu pages. Public clients read the result; no runtime scraping. */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { RESTAURANTS, FOOD_HUB_REASON_BY_ID } from '../src/lib/data';
import { restaurantForPlace } from '../src/lib/catalog-identity';
import { VERIFIED_MENU_DETAILS } from '../src/lib/verified-menu-details';
import { parseDetailContent, type DetailContent } from '../src/lib/detail-content';
import { restaurantJournalMenu } from '../src/lib/detail-journal';
import { milesBetween } from '../src/lib/geo';
import { extractOfficialMenu, officialMenuLinks } from './lib/menu-schema';
import { serviceClient, withCitySyncRuns } from './lib/sync-run';

const client=serviceClient('sync official menus');
const fetchLimit=Number(process.env.DETAIL_MENU_FETCH_LIMIT||100);
const sources:Record<string,string>={
  'osm:1186413904':'https://www.goldenlotusvegan.co/menu-1?menu=menu',
  'osm:1186413846':'https://www.highwirecoffee.com/pages/locations/broadway',
  'osm:1629071719':'https://www.brokendreamsoakland.com/',
  'osm:2722259999':'https://www.awakencafe.com/',
  'osm:2306696660':'https://www.bocanovaoakland.com/menu',
};
const cache=new Map<string,Promise<string>>();
const blockedIp=(ip:string)=>/^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::|fc|fd|fe80:)/i.test(ip);
async function publicUrl(raw:string):Promise<URL>{
  const url=new URL(raw);if(url.protocol==='http:')url.protocol='https:';
  if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname)||!url.hostname.includes('.')||/\.(local|internal|localhost)$/.test(url.hostname))throw new Error('non-public source URL');
  const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(address=>blockedIp(address.address)))throw new Error('non-public source address');
  return url;
}
async function load(raw:string):Promise<string>{
  if(cache.has(raw))return cache.get(raw)!;
  const request=(async()=>{
    let url=await publicUrl(raw);
    for(let redirect=0;redirect<4;redirect++){
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'WayveeMenuSync/1.0 (+https://001-wayvee.vercel.app)','Accept':'text/html'}});
      if(response.status>=300&&response.status<400&&response.headers.get('location')){url=await publicUrl(new URL(response.headers.get('location')!,url).href);continue;}
      if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('source unavailable');
      const reader=response.body?.getReader();if(!reader)throw new Error('empty source');
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8_000_000){await reader.cancel();throw new Error('source page too large');}chunks.push(part.value);}
      return Buffer.concat(chunks).toString('utf8');
    }
    throw new Error('too many redirects');
  })();cache.set(raw,request);return request;
}

void withCitySyncRuns(client,'menus',async city=>{
  const {data,error}=await client.from('places').select('id,name,address,website,image,lat,lon,needs_review,detail_content').eq('city',city.slug);
  if(error)throw new Error(error.message);
  const places=(data||[]).filter(place=>!place.needs_review).sort((a,b)=>milesBetween(city.anchor,{latitude:a.lat,longitude:a.lon})-milesBetween(city.anchor,{latitude:b.lat,longitude:b.lon}));
  let fetched=0,written=0,menus=0,items=0,photos=0,failures=0,index=0;
  const results:string[]=[];
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
      if(raw&&fetched<fetchLimit){
        fetched++;
        try{
          const html=await load(raw),parsed=extractOfficialMenu(html,raw,place);
          if(parsed)content={...content,...parsed,menu:parsed.menu||content?.menu,offers:parsed.offers?.length?parsed.offers:content?.offers};
          if(!content?.menu?.items.length){
            for(const link of officialMenuLinks(html,raw).slice(0,2)){
              try{const page=await load(link),linked=extractOfficialMenu(page,link,place);if(linked?.menu?.items.length){content={...content,...linked,offers:content?.offers};break;}}catch{/* Try the next published menu link. */}
            }
          }
        }catch{failures++;}
      }
      if(!content||(!content.menu?.items.length&&!content.photos?.length))continue;
      content=parseDetailContent(content)!;
      const payload:Record<string,unknown>={detail_content:content};
      if(!place.image&&content.photos?.[0]?.url)payload.image=content.photos[0].url;
      const {error:updateError}=await client.from('places').update(payload).eq('id',place.id).eq('city',city.slug);
      if(updateError)throw new Error('detail update failed: '+updateError.message);
      written++;if(content.menu?.items.length){menus++;items+=content.menu.items.length;}photos+=content.photos?.length||0;
      if(results.length<18)results.push(`${place.name}: ${content.menu?.items.length||0} menu items, ${content.photos?.length||0} photos`);
    }
  }
  await Promise.all(Array.from({length:4},()=>worker()));
  results.forEach(line=>console.log('  '+line));
  const detail=`${written} detail records, ${menus} menus, ${items} dishes, ${photos} photos; ${fetched} sources checked, ${failures} unavailable`;
  console.log(detail);
  if(!written)throw new Error('No verified detail content could be populated');
  return {status:failures?'partial':'ok',rowsWritten:written,detail};
});
