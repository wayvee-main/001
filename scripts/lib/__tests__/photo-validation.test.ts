/** @jest-environment node */
import { createHash } from 'node:crypto';
import { createPhotoValidator,validatePhotoFile } from '../photo-validation';
const png=()=>{const body=Buffer.alloc(80);Buffer.from([137,80,78,71,13,10,26,10]).copy(body);body.writeUInt32BE(600,16);body.writeUInt32BE(400,20);return body;};
it('requires a full successful decode before returning a hash and dimensions',async()=>{
 const body=png(),decode=jest.fn(()=>({stats:async()=>({})}));
 expect(await validatePhotoFile(body,'image/png',decode)).toEqual({sha256:createHash('sha256').update(body).digest('hex'),width:600,height:400,byte_size:80});
 expect(await validatePhotoFile(body,'text/html',decode)).toBeUndefined();
 expect(await validatePhotoFile(body,'image/png',()=>({stats:async()=>{throw new Error('Truncated image');}}))).toBeUndefined();
 const tiny=png();tiny.writeUInt32BE(40,16);expect(await validatePhotoFile(tiny,'image/png',decode)).toBeUndefined();
});
it('memoizes identical source bodies and bounds simultaneous native decodes',async()=>{
 let active=0,peak=0,calls=0;
 const validate=createPhotoValidator(()=>({stats:async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;}}));
 const shared=png();const results=await Promise.all([validate(shared,'image/png'),validate(shared,'image/png'),...Array.from({length:6},()=>validate(png(),'image/png'))]);
 expect(results.every(Boolean)).toBe(true);expect(calls).toBe(7);expect(peak).toBe(2);
});
