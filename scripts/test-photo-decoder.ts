/** Real native decoding regression, with generated test pixels and no network. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { photoDecoder,validatePhotoFile } from './lib/photo-validation';

async function main(){
 const root=process.env.MENU_PHOTO_TOOLS_ROOT;if(!root)throw new Error('Set MENU_PHOTO_TOOLS_ROOT');
 const sharp=createRequire(resolve(root,'package.json'))('sharp') as (input:{create:{width:number;height:number;channels:number;background:string}})=>{png():{toBuffer():Promise<Buffer>}};
 const body=await sharp({create:{width:600,height:400,channels:3,background:'#b8400f'}}).png().toBuffer();
 const decode=photoDecoder(root),valid=await validatePhotoFile(body,'image/png',decode);
 assert.equal(valid?.width,600);assert.equal(valid?.height,400);assert.equal(valid?.sha256.length,64);
 assert.equal(await validatePhotoFile(body.subarray(0,body.length/2),'image/png',decode),undefined);
 assert.equal(await validatePhotoFile(Buffer.from('<html>not a photo</html>'),'image/png',decode),undefined);
 console.log('Image decoder passed: real PNG decodes; truncated files and HTML are rejected');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
