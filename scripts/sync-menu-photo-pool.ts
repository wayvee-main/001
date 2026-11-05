/** Background parsers, local OCR and native image decoding; no LLM calls. */
import { readFileSync } from 'node:fs';
import { appendFile,mkdir,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { serviceClient } from './lib/sync-run';
import { parseDetailContent,type DetailContent,type DetailPhoto } from '../src/lib/detail-content';
import { mergeRegionalDetails } from './lib/regional-details';
import { CollectionLoader,SourceBlocked } from './lib/collection-loader';
import { DetailSourceCache,SourceBudgetExhausted } from './lib/detail-source-cache';
import { extractMenuPhotos,prioritizedPhotoCandidates,sourceKind,stablePhotoUrl,type PlaceIdentity,type SourceLink } from './lib/menu-photo-extract';
import { readMenuDocument } from './lib/menu-documents';
import { renderedMenu } from './lib/menu-browser';
import { readMenuSource } from './lib/menu-source-reader';
import { boundedCollectionLimit,COLLECTION_MENU_SOURCE_MAX,menuCoverage,type MenuSourceEvidence } from './lib/menu-photo-policy';
import { createPhotoValidator,photoDecoder,type VerifiedPhotoFile } from './lib/photo-validation';

const client=serviceClient('collect menu/photo pool');
const requestLimit=boundedCollectionLimit(process.env.MENU_PHOTO_REQUEST_LIMIT);
const cachePath=process.env.MENU_PHOTO_CACHE_PATH||'/tmp/wayvee-menu-photo-sources-v3.json';
const cache=new DetailSourceCache((()=>{try{return JSON.parse(readFileSync(cachePath,'utf8'));}catch{return undefined;}})());
type Job={place_id:string;kind:'menu'|'photos';lease_token:string;attempts:number;source_urls:SourceLink[];place:PlaceIdentity&{id:string;website?:string|null;detail_content?:unknown;image?:string|null}};
type Reservation={run_id:string;budget:number;mode:string;max_bytes:number;workers_per_lane:number;photo_limit:number;image_target:number;burst_until:string};
type Summary={places:number;images:{verified_unique_files:number;catalog_unique_photo_urls:number;venues_with_verified_images:number;target:number;remaining:number;binary_storage:string};menus:{with_items:number;items:number;with_documents:number;source_complete:number;partial:number};jobs:{kind:string;status:string;count:number}[];burst_until:string};
const food=(category?:string)=>/restaurant|cafe|bakery|food|bar|pub|brewery|ice_cream/.test(category||'');
const stats={jobs:0,menus:0,completeMenus:0,dishes:0,photos:0,writes:0,blocked:0,partial:0,unsupported:0,unavailable:0,ready:0,browser:0,documents:0};
class CollectionWriteError extends Error {}

async function main(){
 const {error:seedError}=await client.rpc('seed_regional_enrichment');if(seedError)throw new Error('Queue seed: '+seedError.message);
 const {data:reservation,error:reserveError}=await client.rpc('begin_regional_enrichment',{p_limit:requestLimit});if(reserveError)throw new Error('Request reservation: '+reserveError.message);
 const run=reservation as Reservation,loader=new CollectionLoader(run.budget,{maxBytes:run.max_bytes}),start=Date.now();let fatal:unknown;
 console.log(`Collection mode: ${run.mode}; HTTP reservation ${run.budget}; ${run.workers_per_lane} workers per menu/photo lane; burst until ${run.burst_until}`);
 const finish=async(job:Job,status:string,sources:SourceLink[],error?:string)=>{
  const days=status==='ready'?7:status==='partial'?1:status==='not_applicable'?30:status==='unsupported'?7:Math.min(7,2**Math.min(3,Math.max(0,job.attempts-1)));
  const next=new Date(Date.now()+(status==='pending'?15*60_000:days*86_400_000)).toISOString();
  const {data:completed,error:writeError}=await client.rpc('complete_regional_enrichment',{p_place_id:job.place_id,p_kind:job.kind,p_token:job.lease_token,p_status:status,p_next:next,p_sources:sources,p_error:error||null});
  if(writeError||!completed)throw new Error('Queue checkpoint: '+(writeError?.message||'lease replaced'));
  if(status in stats)(stats as Record<string,number>)[status]++;stats.jobs++;
 };
 let validate:ReturnType<typeof createPhotoValidator>;
 const collect=async(job:Job)=>{
  const p=job.place,raw=p.website?.split(';')[0]||parseDetailContent(p.detail_content)?.sourceUrl;
  if(!raw){await finish(job,'unsupported',[],'No public source URL');return;}
  const initial:SourceLink={url:raw,kind:sourceKind(raw),title:'Official website',trustedLink:false};
  const sources:SourceLink[]=[initial,...(Array.isArray(job.source_urls)?job.source_urls:[]).filter(s=>s?.url&&s.url!==raw)].slice(0,32);
  const evidence:MenuSourceEvidence[]=[],failedSources=new Set<string>();
  let collected:DetailContent|undefined,lastError:unknown,htmlSource:string|undefined,limited=false;
  const menuEvidence=new Set<string>(),jobDeadline=Date.now()+3*60_000;
  const addLinks=(links:SourceLink[])=>{for(const link of links)if(!sources.some(old=>old.url===link.url)){if(sources.length>=32){limited=true;break;}sources.push(link);}};
  const remember=(url:string,result:{content?:DetailContent;menuPage?:boolean;menuComplete?:boolean})=>{
   if(result.menuPage&&result.content?.menu){menuEvidence.add(result.content.menu.url);evidence.push({url,complete:!!result.menuComplete,items:result.content.menu.items.length});}
  };
  try{
   const first=await readMenuSource(loader,cache,raw,p,false);collected=first.content;htmlSource=raw;remember(raw,first);addLinks(first.links);
  }catch(error){lastError=error;failedSources.add(raw);}
  const candidates=sources.slice(1).sort((a,b)=>{
   const rank=(s:SourceLink)=>(s.kind==='official'?0:s.kind==='social'?3:2)+(job.kind==='menu'&&s.document?-1:0)+(job.kind==='photos'&&/gallery|photos/i.test(s.url)?-1:0);
   return rank(a)-rank(b);
  });
  let cursor=0;
  for(;cursor<candidates.length&&cursor<COLLECTION_MENU_SOURCE_MAX;cursor++){
   const source=candidates[cursor];if(job.kind==='photos'&&source.document)continue;
   if(!loader.remaining||Date.now()>jobDeadline){limited=true;break;}
   if(job.kind==='photos'&&(collected?.photos?.length||0)>=run.photo_limit*2)break;
   try{
    let content:DetailContent|undefined;
    if(source.document){
     const r=await loader.resource(source.url,{accept:source.document==='pdf'?'application/pdf':'image/*',maxBody:source.document==='pdf'?10_000_000:5_000_000});
     if(source.document==='pdf'&&!r.body.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Not a public PDF menu');
     content=await readMenuDocument(r.body,source.document,source.url,p);
     if(content?.menu?.items.length){menuEvidence.add(content.menu.url);evidence.push({url:source.url,complete:false,items:content.menu.items.length});}
     const document={url:source.url,title:source.title,format:source.document,sourceUrl:raw,verifiedAt:new Date().toISOString()};
     content={version:1,sourceUrl:source.url,verifiedAt:new Date().toISOString(),...content,menuDocuments:[document]};stats.documents++;
    }else{
     const result=await readMenuSource(loader,cache,source.url,p,source.trustedLink);content=result.content;remember(source.url,result);
     const before=sources.length;addLinks(result.links);for(const link of sources.slice(before))candidates.push(link);
    }
    collected=mergeRegionalDetails(collected,content);
   }catch(error){lastError=error;failedSources.add(source.url);}
  }
  if(cursor>=COLLECTION_MENU_SOURCE_MAX&&cursor<candidates.length)limited=true;
  if(job.kind==='menu'&&!collected?.menu?.items.length&&!collected?.menuDocuments?.length&&food(p.category)&&htmlSource&&loader.remaining>15&&stats.browser<6&&Date.now()<jobDeadline){
   try{stats.browser++;const html=await renderedMenu(htmlSource,loader);if(html){const parsed=extractMenuPhotos(html,htmlSource,p,true);collected=mergeRegionalDetails(collected,parsed.content);remember(htmlSource,parsed);addLinks(parsed.links);if(parsed.links.some(link=>!evidence.some(value=>value.url===link.url)))limited=true;}}catch(error){lastError=error;failedSources.add(htmlSource);}
  }
  const verified:DetailPhoto[]=[],inventory:(VerifiedPhotoFile&{url:string;source_url:string;caption?:string;provider?:string})[]=[],hashes=new Set<string>();
  for(const photo of prioritizedPhotoCandidates(collected).slice(0,run.photo_limit*2)){
   if(!loader.remaining||verified.length>=run.photo_limit||Date.now()>jobDeadline)break;
   const url=stablePhotoUrl(photo.url,photo.sourceUrl||raw);if(!url)continue;
   try{
    const r=await loader.resource(url,{accept:'image/jpeg,image/png,image/webp',maxBody:5_000_000});
    const file=await validate(r.body,r.contentType);if(!file||hashes.has(file.sha256))continue;
    hashes.add(file.sha256);verified.push({...photo,url});
    inventory.push({...file,url,source_url:photo.sourceUrl||raw,caption:photo.caption,provider:photo.provider});
   }catch(error){lastError=error;}
  }
  if(inventory.length){
   const {error}=await client.rpc('record_regional_photo_assets',{p_place_id:job.place_id,p_kind:job.kind,p_token:job.lease_token,p_photos:inventory});
   if(error)throw new CollectionWriteError('Validated image inventory: '+error.message);
  }
  const coverage=menuCoverage(collected,sources,evidence,failedSources.size,limited);
  if(job.kind==='menu'){
   const {data:recorded,error}=await client.rpc('record_regional_menu_coverage',{p_place_id:job.place_id,p_token:job.lease_token,p_coverage:coverage});
   if(error||!recorded)throw new CollectionWriteError('Menu coverage checkpoint: '+(error?.message||'lease replaced'));
  }
  const {data:current,error:readError}=await client.from('regional_places').select('detail_content,image').eq('id',job.place_id).single();if(readError)throw new CollectionWriteError('Current place read: '+readError.message);
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
  if(Object.keys(payload).length){const {error}=await client.from('regional_places').update(payload).eq('id',job.place_id);if(error)throw new CollectionWriteError('Goods write: '+error.message);stats.writes++;stats.photos+=verified.filter(photo=>!existing?.photos?.some(old=>old.url===photo.url)).length;}
  if(publishMenu&&merged?.menu?.items.length){
   stats.menus++;const oldNames=new Set(existing?.menu?.items.map(item=>item.name.toLowerCase()));stats.dishes+=merged.menu.items.filter(item=>!oldNames.has(item.name.toLowerCase())).length;
   if(coverage.status==='source_complete'){stats.completeMenus++;await finish(job,'ready',sources);}
   else await finish(job,'partial',sources,'Published menu items retained; full source-set coverage is incomplete');
  }else if(job.kind==='photos'&&verified.length)await finish(job,'ready',sources);
  else if(lastError instanceof SourceBudgetExhausted||!loader.remaining||limited)await finish(job,'pending',sources,'Request/time budget reached; resume from cached sources');
  else if(job.kind==='menu'&&(collected?.menuDocuments?.length||collected?.menu?.items.length))await finish(job,'partial',sources,'Original menu or featured snapshot linked; full structured extraction incomplete');
  else if(lastError instanceof SourceBlocked)await finish(job,'blocked',sources,'Public source blocked; no access challenge bypass');
  else if(job.kind==='menu'&&!food(p.category)&&!sources.some(source=>source.document||/menu|dinner|lunch|drinks|food/i.test(source.url)))await finish(job,'not_applicable',sources,'No published food/drink menu found');
  else await finish(job,lastError?'unavailable':'unsupported',sources,lastError instanceof Error?lastError.message:'No confidently extracted goods');
 };
 const lane=async(kind:Job['kind'])=>{
  let claimed=0;
  while(loader.remaining&&Date.now()-start<15*60_000&&claimed<600){
   const {data,error}=await client.rpc('claim_regional_enrichment_lane',{p_kind:kind,p_limit:Math.min(run.workers_per_lane,600-claimed)});if(error)throw new Error('Queue claim: '+error.message);
   const jobs=(data||[]) as Job[];if(!jobs.length)break;claimed+=jobs.length;
   const results=await Promise.allSettled(jobs.map(async job=>{
    if(!loader.remaining||Date.now()-start>=15*60_000){await finish(job,'pending',job.source_urls||[],'Budget reached before source request');return;}
    await collect(job);
   }));
   let writeFailure:unknown;
   for(let i=0;i<results.length;i++)if(results[i].status==='rejected'){
    const reason=(results[i] as PromiseRejectedResult).reason;
    await finish(jobs[i],'unavailable',jobs[i].source_urls||[],reason instanceof Error?reason.message:'Worker failed');
    if(reason instanceof CollectionWriteError)writeFailure??=reason;
   }
   if(writeFailure)throw writeFailure;
  }
 };
 try{
  if(run.budget){validate=createPhotoValidator(photoDecoder());const lanes=await Promise.allSettled([lane('menu'),lane('photos')]);for(const result of lanes)if(result.status==='rejected')throw result.reason;}
 }catch(error){fatal=error;}
 finally{
  await mkdir(dirname(cachePath),{recursive:true});await writeFile(cachePath,JSON.stringify(cache.snapshot()));
  const detail=`menu/photo: ${stats.jobs} jobs, ${stats.menus} menus (${stats.completeMenus} source-complete), +${stats.dishes} dishes, +${stats.photos} photos, ${stats.writes} writes; ready ${stats.ready}, partial ${stats.partial}, blocked ${stats.blocked}, unsupported ${stats.unsupported}, unavailable ${stats.unavailable}; HTTP ${loader.requests}/${run.budget}, ${loader.bytes} bytes; ${stats.browser} browser, ${stats.documents} documents; source cache ${cache.stats.cached} hits, ${cache.stats.unchanged} unchanged`;
  console.log(detail);
  const {data:summary,error:summaryError}=await client.rpc('regional_enrichment_summary');
  if(summaryError){console.error('Coverage summary failed: '+summaryError.message);fatal??=new Error(summaryError.message);}
  const total=summary as Summary|null;
  const totals=total?`Images: ${total.images.verified_unique_files} unique validated files / ${total.images.target}; ${total.images.remaining} remaining; ${total.images.catalog_unique_photo_urls} catalog photo URLs. Menus: ${total.menus.with_items} with items, ${total.menus.items} items, ${total.menus.source_complete} source-complete, ${total.menus.with_documents} with documents.`:'';
  if(total){
   console.log(totals);console.log('menu/photo queue: '+JSON.stringify(total));
   if(process.env.MENU_PHOTO_SUMMARY_PATH){await mkdir(dirname(process.env.MENU_PHOTO_SUMMARY_PATH),{recursive:true});await writeFile(process.env.MENU_PHOTO_SUMMARY_PATH,JSON.stringify({checked_at:new Date().toISOString(),run,stats,summary:total},null,2));}
   if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### Menu and photo collection\n\n${totals}\n\n${detail}\n\nImage files remain at their external sources; Supabase stores URLs, content hashes, provenance, menus and progress.\n`);
  }
  const {error}=await client.rpc('finish_regional_enrichment',{p_run_id:run.run_id,p_requests:loader.requests,p_bytes:loader.bytes,p_detail:detail+' '+totals,p_status:fatal?'failed':'ok'});if(error){console.error('Run summary could not be saved:',error.message);fatal??=new Error(error.message);}
 }
 if(fatal)throw fatal;
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Menu/photo collection failed');process.exitCode=1;});
