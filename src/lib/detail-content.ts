/** Public, source-backed detail payload shared by sync jobs and native screens.
 * Menus, offers and artist facts reach every route through the same record. */
export type DetailSourceKind = 'official'|'ubereats'|'doordash'|'social';
export type DetailMenuItem = {name:string;desc?:string;price?:string;image?:string;note?:string;categories:readonly string[];sourceUrl?:string;imageSourceUrl?:string};
export type DetailPhoto = {url:string;caption?:string;sourceUrl?:string;sourceLabel?:string;provider?:DetailSourceKind;attribution?:string};
export type DetailMenuDocument = {url:string;title:string;format:'pdf'|'image';sourceUrl?:string;verifiedAt?:string};
export type DetailOffer = {title:string;label:string;description:string;url:string;expiresAt?:string};
export type DetailArtist = {name:string;role?:string;image?:string;description?:string;url?:string};
export type DetailContent = {
  version:1;sourceUrl:string;verifiedAt:string;description?:string;subtitle?:string;ageLabel?:string;
  photos?:DetailPhoto[];
  menu?:{url:string;title?:string;note?:string;verifiedAt?:string;items:DetailMenuItem[];sourceKind?:Exclude<DetailSourceKind,'social'>;sourceLabel?:string;pricingContext?:'venue'|'delivery'};
  menuDocuments?:DetailMenuDocument[];
  offers?:DetailOffer[];artists?:DetailArtist[];
  notes?:{title:string;body:string;url?:string}[];
  links?:{label:string;url:string}[];
  venue?:{name:string;address?:string;image?:string;url?:string};
};
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const text=(value:unknown,max=3000)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):undefined;
export const publicDetailUrl=(value:unknown):string|undefined=>{
  if(typeof value!=='string'||value.length>4000)return;
  try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return;return u.href;}catch{return;}
};
const list=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.filter(record):[];
const sourceKind=(value:unknown):DetailSourceKind|undefined=>['official','ubereats','doordash','social'].includes(String(value))?value as DetailSourceKind:undefined;
const provenance=(value:Record<string,unknown>)=>{
  const sourceUrl=publicDetailUrl(value.sourceUrl),sourceLabel=text(value.sourceLabel,120),provider=sourceKind(value.provider),attribution=text(value.attribution,300);
  return {...(sourceUrl?{sourceUrl}:{}),...(sourceLabel?{sourceLabel}:{}),...(provider?{provider}:{}),...(attribution?{attribution}:{})};
};

/** Null, malformed or older cached columns stay harmless. Untrusted markup is
 * plain text, external controls only receive http(s), expired offers disappear. */
export function parseDetailContent(value:unknown,now=new Date()):DetailContent|undefined {
  if(!record(value)||value.version!==1)return;
  const sourceUrl=publicDetailUrl(value.sourceUrl),verifiedAt=text(value.verifiedAt,40);
  if(!sourceUrl||!verifiedAt||!Number.isFinite(Date.parse(verifiedAt)))return;
  const content:DetailContent={version:1,sourceUrl,verifiedAt,description:text(value.description),subtitle:text(value.subtitle,180),ageLabel:text(value.ageLabel,80)};
  content.photos=list(value.photos).flatMap(photo=>{const url=publicDetailUrl(photo.url);return url?[{url,caption:text(photo.caption,180),...provenance(photo)}]:[];}).slice(0,16);
  if(record(value.menu)){
    const url=publicDetailUrl(value.menu.url);
    const items=list(value.menu.items).flatMap(item=>{const name=text(item.name,180),sourceUrl=publicDetailUrl(item.sourceUrl),imageSourceUrl=publicDetailUrl(item.imageSourceUrl);return name?[{name,desc:text(item.desc,700),price:text(item.price,100),image:publicDetailUrl(item.image),note:text(item.note,400),categories:Array.isArray(item.categories)?item.categories.map(x=>text(x,60)).filter((x):x is string=>!!x):[],...(sourceUrl?{sourceUrl}:{}),...(imageSourceUrl?{imageSourceUrl}:{})}]:[];}).slice(0,180);
    const menuVerifiedAt=text(value.menu.verifiedAt,40);
    const kind=sourceKind(value.menu.sourceKind),sourceLabel=text(value.menu.sourceLabel,120),pricingContext=['venue','delivery'].includes(String(value.menu.pricingContext))?value.menu.pricingContext as 'venue'|'delivery':undefined;
    if(url&&items.length)content.menu={url,title:text(value.menu.title,100),note:text(value.menu.note,400),verifiedAt:menuVerifiedAt&&Number.isFinite(Date.parse(menuVerifiedAt))?menuVerifiedAt:verifiedAt,items,...(kind&&kind!=='social'?{sourceKind:kind}:{}),...(sourceLabel?{sourceLabel}:{}),...(pricingContext?{pricingContext}:{})};
  }
  if(Array.isArray(value.menuDocuments))content.menuDocuments=list(value.menuDocuments).flatMap(document=>{
    const url=publicDetailUrl(document.url),title=text(document.title,120),sourceUrl=publicDetailUrl(document.sourceUrl),checked=text(document.verifiedAt,40);
    return url&&title&&(document.format==='pdf'||document.format==='image')?[{url,title,format:document.format as 'pdf'|'image',...(sourceUrl?{sourceUrl}:{}),...(checked&&Number.isFinite(Date.parse(checked))?{verifiedAt:checked}:{})}]:[];
  }).slice(0,12);
  content.artists=list(value.artists).flatMap(artist=>{const name=text(artist.name,180);return name?[{name,role:text(artist.role,80),image:publicDetailUrl(artist.image),description:text(artist.description,900),url:publicDetailUrl(artist.url)}]:[];}).slice(0,20);
  content.offers=list(value.offers).flatMap(offer=>{
    const title=text(offer.title,140),label=text(offer.label,100),description=text(offer.description,700),url=publicDetailUrl(offer.url),expiresAt=text(offer.expiresAt,40);
    if(!title||!label||!description||!url||(expiresAt&&(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<now.getTime())))return [];
    return [{title,label,description,url,expiresAt}];
  }).slice(0,10);
  content.notes=list(value.notes).flatMap(note=>{const title=text(note.title,140),body=text(note.body,6000);return title&&body?[{title,body,url:publicDetailUrl(note.url)}]:[];}).slice(0,15);
  content.links=list(value.links).flatMap(link=>{const label=text(link.label,120),url=publicDetailUrl(link.url);return label&&url?[{label,url}]:[];}).slice(0,16);
  if(record(value.venue)){const name=text(value.venue.name,180);if(name)content.venue={name,address:text(value.venue.address,300),image:publicDetailUrl(value.venue.image),url:publicDetailUrl(value.venue.url)};}
  return content;
}

export function detailContentFacts(content?:DetailContent):{label:string;value:string}[] {
  if(!content)return [];
  return [
    ...(content.menu?[{label:'Menu highlights',value:content.menu.items.slice(0,12).map(item=>[item.name,item.price,item.desc,item.note].filter(Boolean).join(' · ')).join('\n')}]:[]),
    ...(content.artists?.length?[{label:'Lineup',value:content.artists.map(artist=>[artist.name,artist.role].filter(Boolean).join(' · ')).join('\n')}]:[]),
    ...(content.ageLabel?[{label:'Age policy',value:content.ageLabel}]:[]),
    ...(content.offers||[]).map(offer=>({label:offer.title,value:offer.label+' · '+offer.description})),
    ...(content.notes||[]).map(note=>({label:note.title,value:note.body})),
  ];
}
