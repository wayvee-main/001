import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { imageDimensions } from './collection-loader';

type Decoder=(body:Buffer,options:{limitInputPixels:number;failOn:string})=>{stats():Promise<unknown>};
export type VerifiedPhotoFile={sha256:string;width:number;height:number;byte_size:number};

/** Native image decoding runs in the collection runner, outside the app's
 * dependency graph. No model API, generated imagery, or partial-file hashes. */
export function photoDecoder(root=process.env.MENU_PHOTO_TOOLS_ROOT):Decoder {
 if(!root)throw new Error('Set MENU_PHOTO_TOOLS_ROOT to the runner image-validation tools');
 return createRequire(resolve(root,'package.json'))('sharp') as Decoder;
}

export async function validatePhotoFile(body:Buffer,contentType:string,decode:Decoder):Promise<VerifiedPhotoFile|undefined> {
 if(!/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(contentType)||!body.length||body.length>5_000_000)return;
 const dimensions=imageDimensions(body);
 if(!dimensions||dimensions.width<300||dimensions.height<180||dimensions.width>8192||dimensions.height>8192||dimensions.width/dimensions.height>3||dimensions.width/dimensions.height<.45)return;
 try{await decode(body,{limitInputPixels:24_000_000,failOn:'error'}).stats();}catch{return;}
 return {sha256:createHash('sha256').update(body).digest('hex'),...dimensions,byte_size:body.length};
}

/** At most two full decodes at once; source-body memo hits share validation. */
export function createPhotoValidator(decode:Decoder,concurrency=2){
 const memo=new WeakMap<Buffer,Promise<VerifiedPhotoFile|undefined>>(),waiting:(()=>void)[]=[];let active=0;
 return (body:Buffer,type:string)=>{
  const known=memo.get(body);if(known)return known;
  const pending=(async()=>{
   if(active>=concurrency)await new Promise<void>(resolve=>waiting.push(resolve));else active++;
   try{return await validatePhotoFile(body,type,decode);}finally{const next=waiting.shift();if(next)next();else active--;}
  })();
  memo.set(body,pending);return pending;
 };
}
