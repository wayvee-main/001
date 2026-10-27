import { streetKey } from '../../src/lib/catalog-identity';
import { parseDetailContent, type DetailContent, type DetailMenuItem } from '../../src/lib/detail-content';

type Element={tag:string;attrs:Record<string,string>;children:(Element|string)[];parent?:Element};
const entities:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
const decode=(text:string)=>text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,key:string)=>key[0]==='#'?String.fromCodePoint(key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1))):entities[key.toLowerCase()]||' ');
const plain=(value:unknown)=>typeof value==='string'?decode(value.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim():'';
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const values=(value:unknown)=>Array.isArray(value)?value:value?[value]:[];
const typeIs=(node:Record<string,unknown>,type:string)=>values(node['@type']).some(value=>typeof value==='string'&&value.split('/').pop()===type);
const absolute=(url:unknown,base:string)=>{try{return typeof url==='string'?new URL(decode(url),base).href:undefined;}catch{return;}};
const photoUrl=(raw:unknown,base:string):string|undefined=>{
  const value=absolute(raw,base);if(!value)return;
  const url=new URL(value);
  // Wix SSR sends blurred lazy-load previews. Its media path before /v1/ is
  // the same named source photograph at native quality, without the crop.
  if(url.hostname==='static.wixstatic.com'&&url.pathname.startsWith('/media/')){
    url.pathname=url.pathname.split('/v1/')[0];url.search='';return url.href;
  }
  return value;
};
const imageUrl=(image:unknown,base:string):string|undefined=>photoUrl(typeof image==='string'?image:isRecord(image)?image.url||image.contentUrl:undefined,base);

function tree(html:string):{root:Element;nodes:Element[]} {
  const root:Element={tag:'root',attrs:{},children:[]},stack=[root],nodes:Element[]=[];
  const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  for(const token of clean.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('<!--')||token.startsWith('<!'))continue;
    if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toLowerCase();const i=stack.map(node=>node.tag).lastIndexOf(tag);if(i>0)stack.length=i;continue;}
    if(token[0]==='<'){
      const tag=token.match(/^<([a-z][\w:-]*)/i)?.[1]?.toLowerCase();if(!tag)continue;
      const attrs:Record<string,string>={};for(const m of token.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]??'');
      const node:Element={tag,attrs,children:[],parent:stack[stack.length-1]};node.parent!.children.push(node);nodes.push(node);
      if(!/\/\s*>$/.test(token)&&!['img','meta','link','input','br','hr','source','wbr','area','base','embed'].includes(tag))stack.push(node);
    }else stack[stack.length-1].children.push(token);
  }
  return {root,nodes};
}
const textOf=(node?:Element):string=>node?plain(node.children.map(child=>typeof child==='string'?child:textOf(child)).join(' ')):'';
const descendants=(node:Element):Element[]=>node.children.flatMap(child=>typeof child==='string'?[]:[child,...descendants(child)]);
const find=(node:Element,predicate:(node:Element)=>boolean)=>descendants(node).find(predicate);
const hook=(node:Element,key:string)=>node.attrs['data-hook']===key;
const cls=(node:Element,key:string)=>(node.attrs.class||'').split(/\s+/).includes(key);

/** Server-side extraction only: published schema.org menus plus semantic Wix
 * and Squarespace menu markup. No inferred dishes, prices or generic photos. */
export function extractOfficialMenu(html:string,url:string,identity:{name:string;address?:string|null},now=new Date()):DetailContent|undefined {
  const graphs:Record<string,unknown>[]=[];
  function walk(value:unknown){if(isRecord(value)){graphs.push(value);Object.values(value).forEach(walk);}else if(Array.isArray(value))value.forEach(walk);}
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(/type\s*=\s*["']application\/ld\+json/i.test(match[1])){try{walk(JSON.parse(match[2]));}catch{/* One broken script does not discard the others. */}}
  const business=graphs.filter(node=>['Restaurant','CafeOrCoffeeShop','FoodEstablishment','BarOrPub','LocalBusiness'].some(type=>typeIs(node,type)));
  const address=streetKey(identity.address);
  if(business.length&&address&&!business.some(node=>{const value=isRecord(node.address)?node.address.streetAddress:node.address;return !value||streetKey(typeof value==='string'?value:plain(value))===address;}))return;
  const items:DetailMenuItem[]=[];
  const add=(item:DetailMenuItem)=>{if(item.name&&!items.some(old=>old.name.toLowerCase()===item.name.toLowerCase()))items.push(item);};
  for(const node of graphs.filter(node=>typeIs(node,'MenuItem'))){
    const name=plain(node.name);if(!name)continue;
    const offer=values(node.offers).find(isRecord),amount=offer?.price??node.price,currency=plain(offer?.priceCurrency||node.priceCurrency);
    const raw=amount==null?'':String(amount),price=raw?(currency==='USD'&&!raw.startsWith('$')?'$'+raw:currency&&currency!=='USD'?currency+' '+raw:raw):undefined;
    const section=graphs.find(parent=>typeIs(parent,'MenuSection')&&values(parent.hasMenuItem).includes(node));
    add({name,desc:plain(node.description)||undefined,price,image:imageUrl(values(node.image)[0],url),categories:[plain(section?.name)||'Menu']});
  }
  const {nodes}=tree(html);
  for(const element of nodes.filter(node=>node.attrs['data-product'])){
    try{
      const product=JSON.parse(element.attrs['data-product']);const name=plain(product.title||product.name);
      const currency=plain(product.price?.currency),amount=product.price?.value;
      const photo=find(element,node=>node.tag==='img');
      // Only a published product block supplies its own name/price/photo.
      if(name)add({name,price:amount==null?undefined:(currency==='USD'?'$':currency+' ')+String(amount),desc:plain(product.description)||undefined,image:photoUrl(photo?.attrs['data-src']||photo?.attrs.src,url),categories:['Featured']});
    }catch{/* Malformed product metadata is not a menu item. */}
  }
  const roots=nodes.filter(node=>hook(node,'item.root')||cls(node,'menu-item'));
  for(const root of roots){
    const name=textOf(find(root,node=>hook(node,'item.name')||cls(node,'menu-item-title')));if(!name)continue;
    const price=textOf(find(root,node=>hook(node,'item.price')||cls(node,'menu-item-price')))||undefined;
    const desc=textOf(find(root,node=>hook(node,'item.description')||cls(node,'menu-item-description')))||undefined;
    let section=root.parent;while(section&&!hook(section,'section.container')&&!cls(section,'menu-section'))section=section.parent;
    const category=section?textOf(find(section,node=>hook(node,'section.name')||cls(node,'menu-section-title'))):'';
    const photo=find(root,node=>node.tag==='img'),wix=find(root,node=>Boolean(node.attrs['data-image-info']));
    let image=photoUrl(photo?.attrs['data-src']||photo?.attrs.src,url);
    if(!image&&wix){try{const info=JSON.parse(wix.attrs['data-image-info']);if(info.imageData?.uri)image='https://static.wixstatic.com/media/'+info.imageData.uri;}catch{/* No association means no dish photo. */}}
    if(image?.startsWith('data:'))image=undefined;
    add({name,desc,price,image,categories:[category||'Menu']});
  }
  const description=nodes.find(node=>node.tag==='meta'&&node.attrs.name==='description')?.attrs.content;
  // OG images are often logos. Keep only explicit content photography and
  // dish associations; never paint a brand mark as a venue photograph.
  const photos=nodes.filter(node=>node.tag==='img'&&(node.attrs['data-src']||node.attrs.src)&&!/logo|icon|badge|award|runner|bestcoffee|winner|payment/i.test(node.attrs.alt||''))
    .map(node=>({url:photoUrl(node.attrs['data-src']||node.attrs.src,url)!,caption:node.attrs.alt||undefined}))
    .filter(photo=>photo.url?.startsWith('https://')&&!/unsplash|pexels|pixabay|wikimedia/i.test(photo.url)&&!/logo|icon|\.svg|\.gif|\.ico|payment|gravatar/i.test(photo.url)).filter((photo,index,array)=>array.findIndex(other=>other.url===photo.url)===index).slice(0,6);
  if(!items.length&&!photos.length)return;
  return parseDetailContent({version:1,sourceUrl:url,verifiedAt:now.toISOString(),description:description?plain(description):undefined,photos:[...items.filter(item=>item.image).map(item=>({url:item.image!,caption:item.name})),...photos].filter((photo,index,all)=>all.findIndex(other=>other.url===photo.url)===index).slice(0,12),
    menu:items.length?{url,title:'Menu',verifiedAt:now.toISOString(),note:'Listed menu prices. Check the official menu for changes and availability.',items}:undefined});
}

export function officialMenuLinks(html:string,base:string):string[] {
  const {nodes}=tree(html),origin=new URL(base).origin;
  return [...new Set(nodes.filter(node=>node.tag==='a'&&/menu|order|pickup/i.test(textOf(node)+' '+node.attrs.href)).flatMap(node=>{
    const url=absolute(node.attrs.href,base);if(!url||/\.pdf(?:[?#]|$)|gift|catering|wholesale/i.test(url))return [];
    const target=new URL(url);return target.origin===origin||target.hostname.endsWith('.'+new URL(base).hostname.replace(/^www\./,''))||/\.(square\.site|toasttab\.com)$/.test(target.hostname)?[url]:[];
  }))].slice(0,3);
}

export { tree as menuTree, textOf as menuTextOf, descendants as menuDescendants, plain as menuPlain };
