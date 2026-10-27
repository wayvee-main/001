import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { SourceBudgetExhausted } from './detail-source-cache';

export class SourceBlocked extends Error {}
export class SourceUnavailable extends Error {}
const privateIp=(ip:string)=>{
 if(ip.includes(':'))return /^(::|fc|fd|fe|ff)/i.test(ip);
 const [a,b]=ip.split('.').map(Number);
 return !Number.isFinite(a)||a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19);
};
export type CollectedResource={url:string;status:number;body:Buffer;contentType:string;etag?:string;lastModified?:string};
type LoaderOptions={request?:typeof fetch;resolve?:(host:string)=>Promise<string[]>;delayMs?:number;maxBytes?:number};

export function robotsAllows(text:string,path:string):boolean {
 const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];let current={agents:[] as string[],rules:[] as {allow:boolean;path:string}[]};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.split('#')[0].trim(),match=line.match(/^([^:]+):\s*(.*)$/);if(!match)continue;
  const key=match[1].toLowerCase(),value=match[2].trim();
  if(key==='user-agent'){
   if(current.rules.length){groups.push(current);current={agents:[],rules:[]};}current.agents.push(value.toLowerCase());
  }else if((key==='allow'||key==='disallow')&&current.agents.length&&value)current.rules.push({allow:key==='allow',path:value});
 }
 groups.push(current);
 const explicit=groups.filter(group=>group.agents.some(agent=>agent.includes('wayvee'))),applicable=explicit.length?explicit:groups.filter(group=>group.agents.includes('*'));
 const matches=applicable.flatMap(group=>group.rules).filter(rule=>{
  const end=rule.path.endsWith('$'),pattern=rule.path.replace(/\$$/,'').split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
  return new RegExp('^'+pattern+(end?'$':'')).test(path);
 }).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
 return matches[0]?.allow??true;
}

/** A single counter covers robots, redirects, HTML, PDF, image validation and
 * browser subresources. Every path uses the same network/DNS guard and throttle. */
export class CollectionLoader {
 requests=0;bytes=0;
 readonly limit:number;
 private readonly request:typeof fetch;private readonly resolve:(host:string)=>Promise<string[]>;
 private readonly delay:number;private readonly maxBytes:number;
 private dns=new Map<string,Promise<string[]>>();private robots=new Map<string,Promise<string>>();
 private hosts=new Map<string,Promise<void>>();private memo=new Map<string,Promise<CollectedResource>>();
 constructor(limit:number,options:LoaderOptions={}){
  this.limit=Math.max(0,Math.min(200,limit));this.request=options.request||fetch;
  this.resolve=options.resolve||(async host=>(await lookup(host,{all:true})).map(item=>item.address));
  this.delay=options.delayMs??1000;this.maxBytes=options.maxBytes??60_000_000;
 }
 get remaining(){return this.bytes>=this.maxBytes?0:Math.max(0,this.limit-this.requests);}
 async publicUrl(raw:string):Promise<URL>{
  const u=new URL(raw);if(u.protocol==='http:')u.protocol='https:';
  if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname)||!u.hostname.includes('.')||/\.(local|internal|localhost)$/.test(u.hostname))throw new SourceBlocked('Non-public source URL');
  let resolved=this.dns.get(u.hostname);if(!resolved){resolved=Promise.race([this.resolve(u.hostname),new Promise<never>((_,reject)=>{const t=setTimeout(()=>reject(new SourceUnavailable('Source DNS timeout')),5000);t.unref?.();})]);this.dns.set(u.hostname,resolved);}
  const addresses=await resolved;if(!addresses.length||addresses.some(privateIp))throw new SourceBlocked('Non-public source address');return u;
 }
 private async slot(host:string){
  const previous=this.hosts.get(host)||Promise.resolve();let release!:()=>void;
  const next=new Promise<void>(resolve=>{release=resolve;});this.hosts.set(host,next);
  await previous;try{if(this.requests>=this.limit||this.bytes>=this.maxBytes)throw new SourceBudgetExhausted();this.requests++;}
  finally{setTimeout(release,this.delay);}
 }
 async canRead(raw:string):Promise<void>{
  const url=await this.publicUrl(raw),origin=url.origin;
  let rule=this.robots.get(origin);if(!rule){rule=this.resource(origin+'/robots.txt',{skipRobots:true,maxBody:200_000,accept:'text/plain,text/html',allowStatuses:[404,410]}).then(r=>r.status===404||r.status===410?'':r.body.toString('utf8'));this.robots.set(origin,rule);}
  if(!robotsAllows(await rule,url.pathname+url.search))throw new SourceBlocked('Disallowed by robots.txt');
 }
 async resource(raw:string,options:{headers?:Record<string,string>;accept?:string;skipRobots?:boolean;maxBody?:number;partial?:boolean;allowStatuses?:number[];memo?:boolean}={}):Promise<CollectedResource>{
  const key=raw+'|'+(options.accept||'')+'|'+JSON.stringify(options.headers||{});
  if(options.memo!==false){const known=this.memo.get(key);if(known)return known;}
  const pending=this.read(raw,options);if(options.memo!==false){this.memo.set(key,pending);pending.catch(()=>this.memo.delete(key));}return pending;
 }
 private async read(raw:string,options:NonNullable<Parameters<CollectionLoader['resource']>[1]>):Promise<CollectedResource>{
  const max=options.maxBody??4_000_000;let url=await this.publicUrl(raw);
  for(let redirects=0;redirects<4;redirects++){
   if(!options.skipRobots)await this.canRead(url.href);
   await this.slot(url.hostname);
   const response=await this.request(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'WayveeMenuPhotoSync/2.0 (+https://github.com/wayvee-main/001)',Accept:options.accept||'text/html,application/xhtml+xml',...options.headers}});
   if(response.status>=300&&response.status<400&&response.status!==304&&response.headers.get('location')){await response.body?.cancel();url=await this.publicUrl(new URL(response.headers.get('location')!,url).href);continue;}
   if([401,403,429].includes(response.status)){await response.body?.cancel();throw new SourceBlocked('Source access/rate limit '+response.status);}
   if(!response.ok&&response.status!==304&&!options.allowStatuses?.includes(response.status)){await response.body?.cancel();throw new SourceUnavailable('Source HTTP '+response.status);}
   const type=response.headers.get('content-type')||'',etag=response.headers.get('etag')||undefined,lastModified=response.headers.get('last-modified')||undefined;
   if(response.status===304)return{url:url.href,status:304,body:Buffer.alloc(0),contentType:type,etag,lastModified};
   if(!options.partial&&Number(response.headers.get('content-length'))>max){await response.body?.cancel();throw new SourceUnavailable('Source body too large');}
   const chunks:Uint8Array[]=[];let size=0;const reader=response.body?.getReader();
   if(reader)while(true){const part=await reader.read();if(part.done)break;this.bytes+=part.value.byteLength;if(this.bytes>this.maxBytes){await reader.cancel();throw new SourceBudgetExhausted();}
    const available=max-size;if(part.value.byteLength>available){if(options.partial&&available>0){chunks.push(part.value.slice(0,available));size+=available;await reader.cancel();break;}await reader.cancel();throw new SourceUnavailable('Source body too large');}
    chunks.push(part.value);size+=part.value.byteLength;if(this.bytes>this.maxBytes){await reader.cancel();throw new SourceBudgetExhausted();}
   }
   return{url:url.href,status:response.status,body:Buffer.concat(chunks),contentType:type,etag,lastModified};
  }throw new SourceUnavailable('Too many source redirects');
 }
}

/** Dimensions from image headers, never an LLM photo guess. */
export function imageDimensions(b:Buffer):{width:number;height:number}|undefined {
 if(b.length>24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
 if(b.length>30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  if(b.toString('ascii',12,16)==='VP8X')return{width:b.readUIntLE(24,3)+1,height:b.readUIntLE(27,3)+1};
  if(b.toString('ascii',12,16)==='VP8L'&&b[20]===0x2f){const bits=b.readUInt32LE(21);return{width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};}
  if(b.toString('ascii',12,16)==='VP8 '&&b[23]===0x9d&&b[24]===0x01&&b[25]===0x2a)return{width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
 }
 if(b.length>4&&b[0]===0xff&&b[1]===0xd8){let i=2;while(i+9<b.length){if(b[i]!==0xff){i++;continue;}const marker=b[i+1];if(marker===0xd9||marker===0xda)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{height:b.readUInt16BE(i+5),width:b.readUInt16BE(i+7)};const length=b.readUInt16BE(i+2);if(length<2)break;i+=length+2;}}
 return;
}
