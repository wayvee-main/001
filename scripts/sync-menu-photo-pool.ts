/** Resumable, source-backed menu/photo pool. No LLM calls, login sessions or
 * raw-page persistence. Every external HTTP request consumes the same budget. */
import { readFileSync } from 'node:fs';
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { serviceClient } from './lib/sync-run';
import { parseDetailContent,type DetailContent,type DetailPhoto } from '../src/lib/detail-content';
import { mergeRegionalDetails } from './lib/regional-details';
import { CollectionLoader,imageDimensions,SourceBlocked } from './lib/collection-loader';
import { DetailSourceCache,SourceBudgetExhausted } from './lib/detail-source-cache';
import { extractMenuPhotos,sourceKind,stablePhotoUrl,type PlaceIdentity,type SourceLink } from './lib/menu-photo-extract';
import { readMenuDocument } from './lib/menu-documents';
import { renderedMenu } from './lib/menu-browser';
import { readMenuSource } from './lib/menu-source-reader';

const client=serviceClient('collect menu/photo pool');
const configuredLimit=Number(process.env.MENU_PHOTO_REQUEST_LIMIT??'200');
const requestLimit=Math.max(0,Math.min(200,Number.isFinite(configuredLimit)?configuredLimit:200));
const cachePath=process.env.MENU_PHOTO_CACHE_PATH||'/tmp/wayvee-menu-photo-sources-v2.json';
const cache=new DetailSourceCache((()=>{try{return JSON.parse(readFileSync(cachePath,'utf8'));}catch{return undefined;}})());
type Job={place_id:string;kind:'menu'|'photos';lease_token:string;attempts:number;source_urls:SourceLink[];place:PlaceIdentity&{id:string;website?:string|null;detail_content?:unknown;image?:string|null}};
const food=(category?:string)=>/restaurant|cafe|bakery|food|bar|pub|brewery|ice_cream/.test(category||'');
const stats={jobs:0,menus:0,dishes:0,photos:0,writes:0,blocked:0,partial:0,unsupported:0,unavailable:0,ready:0,browser:0,documents:0};
const placeLocks=new Map<string,Promise<void>>();

async function main(){
 const {error:seedError}=await client.rpc('seed_regional_enrichment');if(seedError)throw new Error('Queue seed: '+seedError.message);
 const {data:reservation,error:reserveError}=await client.rpc('begin_regional_enrichment',{p_limit:requestLimit});if(reserveError)throw new Error('Request reservation: '+reserveError.message);
 const run=reservation as {run_id:string;budget:number},loader=new CollectionLoader(run.budget),start=Date.now();let fatal:unknown;
 const finish=async(job:Job,status:string,sources:SourceLink[],error?:string)=>{
  const days=status==='ready'?7:status==='partial'?3:status==='not_applicable'?30:status==='unsupported'?7:Math.min(7,2**Math.min(3,Math.max(0,job.attempts-1)));
  const next=new Date(Date.now()+(status==='pending'?3_600_000:days*86_400_000)).toISOString();
  const {error:writeError}=await client.rpc('complete_regional_enrichment',{p_place_id:job.place_id,p_kind:job.kind,p_token:job.lease_token,p_status:status,p_next:next,p_sources:sources,p_error:error||null});
  if(writeError)throw new Error('Queue checkpoint: '+writeError.message);
  if(status in stats)(stats as Record<string,number>)[status]++;stats.jobs++;
 };
 const readHtml=(url:string,place:PlaceIdentity,trusted:boolean)=>readMenuSource(loader,cache,url,place,trusted);
 const collect=async(job:Job)=>{
  const p=job.place,raw=p.website?.split(';')[0]||parseDetailContent(p.detail_content)?.sourceUrl;
  if(!raw){await finish(job,'unsupported',[],'No public source URL');return;}
  const initial:SourceLink={url:raw,kind:sourceKind(raw),title:'Official website',trustedLink:false};
  const sources:SourceLink[]=[initial,...(Array.isArray(job.source_urls)?job.source_urls:[]).filter(s=>s?.url&&s.url!==raw)].slice(0,8);
  let collected:DetailContent|undefined,lastError:unknown,htmlSource:string|undefined,explicitMenuRead=/menu|dinner|lunch|drinks/i.test(new URL(raw).pathname);
  const menuEvidence=new Set<string>();
  try{
   const first=await readHtml(raw,p,false);collected=first.content;htmlSource=raw;if(first.menuPage&&first.content?.menu)menuEvidence.add(first.content.menu.url);
   for(const link of first.links)if(!sources.some(old=>old.url===link.url))sources.push(link);
  }catch(error){lastError=error;}
  // Menus favor official menu/documents; photos favor official galleries,
  // then merchant-linked ordering stores and public venue-authored posts.
  const candidates=sources.slice(1).sort((a,b)=>{
   const rank=(s:SourceLink)=>(s.kind==='official'?0:s.kind==='social'?3:2)+(job.kind==='menu'&&s.document?-1:0)+(job.kind==='photos'&&/gallery|photos/i.test(s.url)?-1:0);
   return rank(a)-rank(b);
  });
  for(let cursor=0;cursor<candidates.length&&cursor<5;cursor++){
   const source=candidates[cursor];
   // The photo queue does not download menu scans/PDFs that cannot supply
   // venue or dish photography. Their published links are already retained.
   if(job.kind==='photos'&&source.document)continue;
   if(!loader.remaining)break;
   if(job.kind==='menu'&&collected?.menu?.items.length&&explicitMenuRead&&menuEvidence.has(collected.menu.url))break;
   if(job.kind==='photos'&&(collected?.photos?.length||0)>=6)break;
   try{
    let content:DetailContent|undefined;
    if(source.document){
     const r=await loader.resource(source.url,{accept:source.document==='pdf'?'application/pdf':'image/*',maxBody:source.document==='pdf'?10_000_000:5_000_000});
     if(source.document==='pdf'&&!r.body.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Not a public PDF menu');
     if(job.kind==='menu')content=await readMenuDocument(r.body,source.document,source.url,p);
     if(content?.menu?.items.length){menuEvidence.add(content.menu.url);explicitMenuRead=true;}
     const document={url:source.url,title:source.title,format:source.document,sourceUrl:raw,verifiedAt:new Date().toISOString()};
     content={version:1,sourceUrl:source.url,verifiedAt:new Date().toISOString(),...content,menuDocuments:[document]};stats.documents++;
    }else{
     const result=await readHtml(source.url,p,source.trustedLink);content=result.content;if(result.menuPage&&content?.menu){menuEvidence.add(content.menu.url);explicitMenuRead=true;}
     for(const link of result.links)if(!sources.some(old=>old.url===link.url)&&sources.length<12){sources.push(link);candidates.push(link);}
    }
    collected=mergeRegionalDetails(collected,content);
   }catch(error){lastError=error;}
  }
  if(job.kind==='menu'&&!collected?.menu?.items.length&&!collected?.menuDocuments?.length&&food(p.category)&&htmlSource&&loader.remaining>15&&stats.browser<2){
   try{stats.browser++;const html=await renderedMenu(htmlSource,loader);if(html){const parsed=extractMenuPhotos(html,htmlSource,p,true);collected=mergeRegionalDetails(collected,parsed.content);if(parsed.menuPage&&parsed.content?.menu)menuEvidence.add(parsed.content.menu.url);}}catch(error){lastError=error;}
  }
  // Validate only a bounded set, then publish actual source photography. The
  // remaining candidate URLs stay off the public photo pool until checked.
  const verified:DetailPhoto[]=[];
  for(const photo of (collected?.photos||[]).slice(0,8)){
   if(!loader.remaining||verified.length>=3)break;
   const url=stablePhotoUrl(photo.url,photo.sourceUrl||raw);if(!url)continue;
   try{const r=await loader.resource(url,{accept:'image/jpeg,image/png,image/webp',headers:{Range:'bytes=0-65535'},maxBody:65536,partial:true});
    const dimensions=imageDimensions(r.body);if(!dimensions||dimensions.width<300||dimensions.height<180||dimensions.width/dimensions.height>3||dimensions.width/dimensions.height<.45)continue;
    verified.push({...photo,url});
   }catch(error){lastError=error;}
  }
  const {data:current,error:readError}=await client.from('regional_places').select('detail_content,image').eq('id',job.place_id).single();if(readError)throw new Error('Current place read: '+readError.message);
  const existing=parseDetailContent(current.detail_content),valid=new Set(verified.map(photo=>photo.url));
  const publishMenu=job.kind==='menu'&&collected?.menu&&menuEvidence.has(collected.menu.url);
  let incoming:DetailContent|undefined=collected?{...collected,photos:verified,menu:publishMenu&&collected.menu?{...collected.menu,items:collected.menu.items.map(item=>({...item,image:item.image&&valid.has(item.image)?item.image:undefined,imageSourceUrl:item.image&&valid.has(item.image)?item.imageSourceUrl:undefined}))}:undefined}:undefined;
  if(job.kind==='photos'&&existing?.menu){
   const associations=new Map(verified.filter(photo=>photo.caption).map(photo=>[photo.caption!.toLowerCase(),photo]));
   incoming={version:1,sourceUrl:collected?.sourceUrl||existing.sourceUrl,verifiedAt:new Date().toISOString(),...incoming,menu:{...existing.menu,items:existing.menu.items.map(item=>{const photo=associations.get(item.name.toLowerCase());return !item.image&&photo?{...item,image:photo.url,imageSourceUrl:photo.sourceUrl}:item;})}};
  }
  const merged=mergeRegionalDetails(existing,incoming),payload:Record<string,unknown>={};
  if(merged&&JSON.stringify(merged)!==JSON.stringify(existing))payload.detail_content=merged;
  if(!current.image&&verified[0])payload.image=verified[0].url;
  if(Object.keys(payload).length){const {error}=await client.from('regional_places').update(payload).eq('id',job.place_id);if(error)throw new Error('Goods write: '+error.message);stats.writes++;stats.photos+=verified.filter(photo=>!existing?.photos?.some(old=>old.url===photo.url)).length;}
  if(job.kind==='menu'&&collected?.menu?.items.length&&merged?.menu?.items.length&&menuEvidence.has(merged.menu.url)){stats.menus++;const oldNames=new Set(existing?.menu?.items.map(item=>item.name.toLowerCase()));stats.dishes+=merged.menu.items.filter(item=>!oldNames.has(item.name.toLowerCase())).length;await finish(job,'ready',sources.slice(0,12));}
  else if(job.kind==='photos'&&verified.length)await finish(job,'ready',sources.slice(0,12));
  else if(lastError instanceof SourceBudgetExhausted||!loader.remaining)await finish(job,'pending',sources.slice(0,12),'Request budget reached; resume next hour');
  else if(job.kind==='menu'&&(collected?.menuDocuments?.length||collected?.menu?.items.length))await finish(job,'partial',sources.slice(0,12),'Original menu or featured snapshot linked; full structured extraction incomplete');
  else if(lastError instanceof SourceBlocked)await finish(job,'blocked',sources.slice(0,12),'Public source blocked; no access challenge bypass');
  else if(job.kind==='menu'&&!food(p.category)&&!sources.some(source=>source.document||/menu|dinner|lunch|drinks|food/i.test(source.url)))await finish(job,'not_applicable',sources.slice(0,12),'No published food/drink menu found');
  else await finish(job,lastError?'unavailable':'unsupported',sources.slice(0,12),lastError instanceof Error?lastError.message:'No confidently extracted goods');
 };
 try{
  while(loader.remaining&&Date.now()-start<15*60_000&&stats.jobs<100){
   const {data,error}=await client.rpc('claim_regional_enrichment',{p_limit:4});if(error)throw new Error('Queue claim: '+error.message);
   const jobs=(data||[]) as Job[];if(!jobs.length)break;
   const results=await Promise.allSettled(jobs.map(async job=>{
    const previous=placeLocks.get(job.place_id)||Promise.resolve();let release!:()=>void;const current=new Promise<void>(resolve=>{release=resolve;});placeLocks.set(job.place_id,current);
    await previous;try{if(!loader.remaining){await finish(job,'pending',job.source_urls||[],'Budget reached before source request');return;}await collect(job);}finally{release();}
   }));
   for(let i=0;i<results.length;i++)if(results[i].status==='rejected'){const reason=(results[i] as PromiseRejectedResult).reason;await finish(jobs[i],'unavailable',jobs[i].source_urls||[],reason instanceof Error?reason.message:'Worker failed');}
  }
 }catch(error){fatal=error;}
 finally{
  await mkdir(dirname(cachePath),{recursive:true});await writeFile(cachePath,JSON.stringify(cache.snapshot()));
  const detail=`menu/photo: ${stats.jobs} jobs, ${stats.menus} menus, +${stats.dishes} dishes, +${stats.photos} photos, ${stats.writes} writes; ready ${stats.ready}, partial ${stats.partial}, blocked ${stats.blocked}, unsupported ${stats.unsupported}, unavailable ${stats.unavailable}; HTTP ${loader.requests}/${run.budget}, ${loader.bytes} bytes; ${stats.browser} browser, ${stats.documents} documents`;
  console.log(detail);
  const {error}=await client.rpc('finish_regional_enrichment',{p_run_id:run.run_id,p_requests:loader.requests,p_bytes:loader.bytes,p_detail:detail,p_status:fatal?'failed':'ok'});if(error)console.warn('Run summary could not be saved:',error.message);
  const summary=await client.rpc('regional_enrichment_summary');if(!summary.error)console.log('menu/photo queue: '+JSON.stringify(summary.data));
 }
 if(fatal)throw fatal;
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Menu/photo collection failed');process.exitCode=1;});
