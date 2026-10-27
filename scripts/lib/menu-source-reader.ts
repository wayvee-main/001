import type { CollectionLoader } from './collection-loader';
import { SourceBlocked,SourceUnavailable } from './collection-loader';
import { DetailSourceCache } from './detail-source-cache';
import { extractMenuPhotos,sourceKind,type PlaceIdentity } from './menu-photo-extract';

/** A retained cache snapshot is not evidence that this refresh succeeded.
 * Failed/blocked/budgeted reads propagate; caller preserves the DB's last good
 * goods separately and checkpoints the actual source availability. */
export async function readMenuSource(loader:CollectionLoader,cache:DetailSourceCache,url:string,place:PlaceIdentity,trusted:boolean){
 const key=JSON.stringify(['menu-photo-v2',url,place.name,place.address]);let failure:unknown;
 const result=await cache.read(key,async headers=>{
  try{const r=await loader.resource(url,{headers});if(!/text\/html|application\/xhtml/i.test(r.contentType)&&r.status!==304)throw new SourceUnavailable('Not an HTML page');return{status:r.status,body:r.body.toString('utf8'),etag:r.etag,lastModified:r.lastModified};}
  catch(error){failure=error;throw error;}
 },html=>{
  const parsed=extractMenuPhotos(html,url,place,trusted);
  if(parsed.blocked){failure=new SourceBlocked('Access challenge');throw failure;}
  return{content:parsed.content,links:parsed.links.map(link=>link.url),menuPage:parsed.menuPage};
 });
 if(failure)throw failure;
 if((cache.status(key)?.failures||0)>0)throw new SourceUnavailable('Source is in failure backoff; retained data is not a fresh result');
 const links=(result?.links||[]).map(url=>({url,kind:sourceKind(url),document:/\.pdf(?:[?#]|$)/i.test(url)?'pdf' as const:/\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url)?'image' as const:undefined,title:/\.pdf(?:[?#]|$)/i.test(url)?'Published menu':'Menu or gallery',trustedLink:true}));
 return{content:result?.content,links,menuPage:result?.menuPage};
}
