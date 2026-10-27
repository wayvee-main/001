import { streetKey } from '../../src/lib/catalog-identity';
import { parseDetailContent, type DetailContent, type DetailMenuDocument, type DetailMenuItem, type DetailPhoto, type DetailSourceKind } from '../../src/lib/detail-content';
import { extractOfficialMenu, menuTree, menuTextOf, menuDescendants, menuPlain } from './menu-schema';

export type PlaceIdentity={name:string;address?:string|null;category?:string};
export type SourceLink={url:string;kind:'official'|'ubereats'|'doordash'|'social';document?:'pdf'|'image';title:string;trustedLink:boolean};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:v?[v]:[];
const absolute=(v:unknown,base:string)=>{try{const u=new URL(typeof v==='string'?v:'',base);return /^https:$/.test(u.protocol)&&!u.username&&!u.password?u.href:undefined;}catch{return;}};
const cleanName=(value:unknown)=>menuPlain(value).replace(/^\d+[.)]\s*/,'').trim();
export const sourceLabel=(kind:DetailSourceKind)=>({official:'Official website',ubereats:'Uber Eats',doordash:'DoorDash',social:'Venue social post'}[kind]);
export function sourceKind(url:string):DetailSourceKind {
 const host=new URL(url).hostname.toLowerCase();
 return /(^|\.)ubereats\.com$/.test(host)?'ubereats':/(^|\.)doordash\.com$/.test(host)?'doordash':/(^|\.)(instagram\.com|facebook\.com|fb\.com)$/.test(host)?'social':'official';
}
export function stablePhotoUrl(raw:unknown,base:string):string|undefined {
 const value=absolute(raw,base);if(!value)return;
 const u=new URL(value);
 if(/(?:logo|avatar|profile[_-]?(?:pic|image)|favicon|icon|payment|gravatar)|\.(?:svg|gif|ico)(?:$|[?])/i.test(u.pathname))return;
 if(/(?:unsplash|pexels|pixabay|wikimedia)/i.test(u.hostname))return;
 // Signed social/CDN URLs are refreshed at their source, not put into a
 // permanent image pool. No stripping a signature to manufacture a URL.
 if([...u.searchParams.keys()].some(key=>/^(?:expires|x-amz-signature|x-amz-expires|token|oe|signature)$/i.test(key)))return;
 if(u.hostname==='static.wixstatic.com'&&u.pathname.startsWith('/media/')){u.pathname=u.pathname.split('/v1/')[0];u.search='';}
 return u.href;
}
function jsonNodes(html:string):{node:Record<string,unknown>;path:string}[] {
 const result:{node:Record<string,unknown>;path:string}[]=[];let seen=0;
 const visit=(value:unknown,path:string)=>{if(++seen>80000)return;if(object(value)){result.push({node:value,path});for(const [key,child] of Object.entries(value))visit(child,path+'.'+key);}else if(Array.isArray(value))value.forEach(child=>visit(child,path));};
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(match[2].length>2_500_000)continue;
  if(/application\/(?:ld\+)?json|__NEXT_DATA__|__PRELOADED_STATE__/i.test(match[1])){try{visit(JSON.parse(match[2]),'root');}catch{/* Not executable JavaScript. */}}
 }
 return result;
}
const image=(raw:unknown,base:string)=>stablePhotoUrl(typeof raw==='string'?raw:object(raw)?raw.url||raw.contentUrl:undefined,base);
export function discoverSources(html:string,base:string):SourceLink[] {
 const {nodes}=menuTree(html),origin=new URL(base).origin,links:SourceLink[]=[];
 for(const node of nodes.filter(node=>node.tag==='a'&&node.attrs.href)){
  const url=absolute(node.attrs.href,base);if(!url)continue;
  const target=new URL(url),kind=sourceKind(url),label=menuTextOf(node)||node.attrs['aria-label']||'';
  const pdf=/\.pdf(?:[?#]|$)/i.test(url),img=/\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(url);
  const menu=/menu|dinner|lunch|brunch|breakfast|drinks|food|order|pickup/i.test(label+' '+target.pathname);
  const official=target.origin===origin||target.hostname.replace(/^www\./,'')===new URL(base).hostname.replace(/^www\./,'');
  const ordering=(kind==='ubereats'||kind==='doordash')&&/\/store\//.test(target.pathname);
  const social=kind==='social'&&/\/(?:p|reel|posts|photos)\//.test(target.pathname);
  if((official&&(menu||/gallery|photos|pictures/i.test(label+' '+target.pathname))&&!/gift|catering|wholesale/i.test(label+' '+url))||ordering||social){
   if(!links.some(link=>link.url===url))links.push({url,kind,document:pdf?'pdf':img&&menu?'image':undefined,title:label.slice(0,100)||(/drinks/i.test(url)?'Drinks menu':'Menu'),trustedLink:true});
  }
 }
 return links.sort((a,b)=>(a.kind==='official'?0:a.kind==='social'?2:1)-(b.kind==='official'?0:b.kind==='social'?2:1)).slice(0,12);
}
function identityMatches(nodes:ReturnType<typeof jsonNodes>,identity:PlaceIdentity,trusted:boolean):boolean {
 const expected=streetKey(identity.address),norm=(v:string)=>v.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const businesses=nodes.map(x=>x.node).filter(node=>/Restaurant|LocalBusiness|CafeOrCoffeeShop|BarOrPub|Store/.test(String(node['@type']||''))||((node.address||node.storeAddress)&&typeof (node.name||node.title)==='string'));
 const addressOf=(node:Record<string,unknown>)=>{const a=node.address||node.storeAddress;return object(a)?menuPlain(a.streetAddress||a.address1||a.street1):menuPlain(a);};
 if(expected&&businesses.length&&businesses.every(node=>addressOf(node)&&streetKey(addressOf(node))!==expected))return false;
 if(trusted)return true;
 return !!expected&&businesses.some(node=>streetKey(addressOf(node))===expected&&norm(menuPlain(node.name||node.title))===norm(identity.name));
}

/** Only same-line source names/prices are parsed from PDF/OCR text. Multiple
 * price columns and uncertain OCR lines stay in the linked original document. */
export function menuFromText(text:string,url:string,identity:PlaceIdentity,now=new Date(),confidence?:Map<string,number>):DetailContent|undefined {
 const items:DetailMenuItem[]=[];let section='Menu',pending='';
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line||line.length>350)continue;
  if(confidence&&(confidence.get(line)??0)<90){pending='';continue;}
  if(/^[A-Z][A-Z &'’/\-]{2,55}$/.test(line)){section=line;pending='';continue;}
  const dollar=[...line.matchAll(/[$£€]\s?\d{1,4}(?:[.,]\d{1,2})?(?!\d)/g)];
  if(dollar.length>1){pending='';continue;}
  const terminal=line.match(/(?:\s|^)([$£€]?\s?\d{1,3}(?:[.,]\d{1,2})?(?:\/\d{1,3}(?:[.,]\d{1,2})?)?(?:\s+each)?)\s*$/i);
  if(!terminal){if(/^[A-Z]/.test(line)&&line.length>8)pending=line;continue;}
  let body=line.slice(0,terminal.index).trim();
  if(pending&&/^\s{2,}/.test(raw)&&/^[a-z]/.test(body))body=pending+' '+body;
  pending='';
  if(!dollar.length&&!/\s{2,}\d|[-–—]/.test(line)&&body.split(/\s+/).length<3)continue;
  if(/\s{2,}\d{1,3}(?:[.,]\d{1,2})?\s{2,}/.test(body)||/^(?:add\s|minimum\b|subtotal\b|total\b|tax\b|delivery\b|gratuity\b|serves\b|calories\b)/i.test(body))continue;
  const split=body.search(/\s[-–—]\s*|[–—]/),name=cleanName((split>=0?body.slice(0,split):body).replace(/[.·…\s]+$/,'')),desc=split>=0?body.slice(split).replace(/^[\s–—-]+/,'').trim():undefined;
  if(name.length<3||name.length>100||name.split(/\s+/).length>13||/^\d|https?:/i.test(name))continue;
  if(!items.some(item=>item.name.toLowerCase()===name.toLowerCase()))items.push({name,desc,price:terminal[1].trim().replace(/([$£€])\s+/,'$1'),categories:[section],sourceUrl:url});
 }
 return items.length?parseDetailContent({version:1,sourceUrl:url,verifiedAt:now.toISOString(),menu:{url,sourceKind:'official',sourceLabel:'Official menu',pricingContext:'venue',verifiedAt:now.toISOString(),items}}):undefined;
}

export function extractMenuPhotos(html:string,url:string,identity:PlaceIdentity,trustedLink=false,now=new Date()):{content?:DetailContent;links:SourceLink[];blocked:boolean;menuPage?:boolean} {
 const kind=sourceKind(url),label=sourceLabel(kind),graphs=jsonNodes(html),{root,nodes}=menuTree(html);
 const visible=menuTextOf(root).slice(0,5000),title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 const blocked=/just a moment|pardon our interruption|access denied|robot check|captcha challenge/i.test(title)||/verify (?:that )?you are human|checking (?:your )?browser|request blocked|enable javascript and cookies to continue/i.test(visible);
 if(blocked)return {links:[],blocked:true};
 if(kind!=='official'&&!identityMatches(graphs,identity,trustedLink))return{links:[],blocked:false};
 const official=kind==='official'?extractOfficialMenu(html,url,identity,now):undefined;
 // Keep the existing branch-address check even for ordinary semantic markup.
 if(kind==='official'&&graphs.length&&!identityMatches(graphs,identity,true))return{links:[],blocked:false};
 const items:DetailMenuItem[]=[...(official?.menu?.items||[])],photos:DetailPhoto[]=[];
 const addItem=(item:DetailMenuItem)=>{if(item.name&&!/gift card|gift certificate|t-shirt|merchandise|donation/i.test(item.name)&&!items.some(old=>old.name.toLowerCase()===item.name.toLowerCase()))items.push(item);};
 const addPhoto=(raw:unknown,caption?:string)=>{const value=image(raw,url);if(value&&!/gift card|gift certificate|t-shirt|merchandise|donation/i.test(caption||'')&&!photos.some(photo=>photo.url===value))photos.push({url:value,caption,sourceUrl:url,sourceLabel:label,provider:kind});};
 for(const {node,path} of graphs){
  const nodeType=String(node['@type']||''),name=cleanName(node.name||node.title||node.itemName);
  if(/MenuItem|Product/.test(nodeType)||((kind==='ubereats'||kind==='doordash')&&/menu|items|dishes|catalog|products/i.test(path)&&!node.address&&!node.storeAddress&&(node.description||node.price||node.displayPrice||node.imageUrl))){
   if(!name||name.length>180)continue;
   const offer=array(node.offers).find(object),formatted=menuPlain(node.displayPrice||node.formattedPrice||node.priceString),raw=offer?.price??node.price;
   const price=/[$£€]\s?\d/.test(formatted)?formatted:/MenuItem|Product/.test(nodeType)&&raw!=null&&/^(?:\d+(?:\.\d{1,2})?)$/.test(String(raw))?(String(offer?.priceCurrency||node.priceCurrency)==='USD'?'$':'')+String(raw):typeof raw==='string'&&/[$£€]\s?\d/.test(raw)?raw:undefined;
   const dishImage=image(node.imageUrl||node.imageURL||node.image||node.photoUrl||array(node.images)[0],url);
   addItem({name,desc:menuPlain(node.description)||undefined,price,image:dishImage,categories:[menuPlain(node.category)||'Menu'],sourceUrl:url,...(dishImage?{imageSourceUrl:url}:{})});
  }
  if(/Restaurant|LocalBusiness|CafeOrCoffeeShop|BarOrPub|ImageObject/.test(nodeType))array(node.image||node.contentUrl).forEach(raw=>addPhoto(raw,menuPlain(node.caption)||undefined));
 }
 if(kind==='official'){
  for(const node of nodes){
   const className=node.attrs.class||'';
   if(/(?:menu|food|dish|product)[_-]?(?:item|row)/i.test(className)){
    const descendants=menuDescendants(node),title=descendants.find(child=>/^h[2-5]$/.test(child.tag)||/item[_-]?name|title/.test(child.attrs.class||''));
    const priceNode=descendants.find(child=>/price|amount/.test(child.attrs.class||'')),name=cleanName(title?menuTextOf(title):''),price=priceNode?menuTextOf(priceNode):'';
    if(name&&/[$£€]\s?\d/.test(price)&&price.length<50){const photo=descendants.find(child=>child.tag==='img'),photoUrl=image(photo?.attrs['data-src']||photo?.attrs.src,url);addItem({name,price,categories:['Menu'],sourceUrl:url,image:photoUrl,...(photoUrl?{imageSourceUrl:url}:{})});}
   }
  }
 }
 for(const node of nodes){
  if(node.tag==='img'&&!/logo|avatar|profile|icon|badge|award|payment|winner/i.test((node.attrs.alt||'')+' '+(node.attrs.class||''))){
   const srcset=node.attrs['data-srcset']||node.attrs.srcset;
   const best=srcset?.split(',').map(s=>s.trim().split(/\s+/)[0]).pop();addPhoto(best||node.attrs['data-src']||node.attrs['data-original']||node.attrs.src,node.attrs.alt||undefined);
  }
  if(node.tag==='meta'&&node.attrs.property==='og:image'&&kind==='social')addPhoto(node.attrs.content);
  if(kind==='official'&&node.attrs.style)for(const match of node.attrs.style.matchAll(/background(?:-image)?\s*:[^;]*url\(["']?([^"')]+)["']?\)/gi))addPhoto(match[1]);
 }
 for(const item of items)if(item.image)addPhoto(item.image,item.name);
 for(const photo of official?.photos||[])addPhoto(photo.url,photo.caption);
 const links=kind==='official'?discoverSources(html,url):[];
 const documents:DetailMenuDocument[]=links.filter(link=>link.document).map(link=>({url:link.url,title:link.title,format:link.document!,sourceUrl:url,verifiedAt:now.toISOString()}));
 const content=(items.length||photos.length||documents.length)?parseDetailContent({version:1,sourceUrl:url,verifiedAt:now.toISOString(),description:official?.description,photos,
  menu:items.length&&kind!=='social'?{...official?.menu,url,items:items.map(item=>({...item,sourceUrl:item.sourceUrl||url,imageSourceUrl:item.imageSourceUrl||(item.image?url:undefined)})),sourceKind:kind,sourceLabel:label,pricingContext:kind==='official'?'venue':'delivery',note:kind==='official'?'Published menu prices; availability may change.':`${label} delivery prices; in-venue prices may differ.`}:undefined,menuDocuments:documents}):undefined;
 const menuPage=!!items.length&&(kind==='ubereats'||kind==='doordash'||/MenuItem|hasMenuItem|data-hook=["']item\.root|class=["'][^"']*menu-item/i.test(html)||/menu|dinner|lunch|drinks/i.test(new URL(url).pathname));
 return{content,links,blocked:false,menuPage};
}
