/** @jest-environment node */
import { CollectionLoader,SourceBlocked,imageDimensions,robotsAllows } from '../collection-loader';
import { SourceBudgetExhausted } from '../detail-source-cache';
const resolve=async()=>['8.8.8.8'];
it('honors longest robots rules and explicit agent groups',()=>{
 expect(robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/menu','/private/menu')).toBe(true);
 expect(robotsAllows('User-agent: *\nDisallow: /private','/private/photo')).toBe(false);
 expect(robotsAllows('User-agent: *\nAllow: /\nUser-agent: WayveeMenuPhotoSync\nDisallow: /','/menu')).toBe(false);
});
it('counts robots, redirects and browser/image resources against one strict budget',async()=>{
 const request=jest.fn(async(url:URL)=>url.pathname==='/robots.txt'?new Response('User-agent: *\nAllow: /'):url.pathname==='/start'?new Response('',{status:302,headers:{location:'/menu'}}):new Response('menu',{headers:{'content-type':'text/html'}}));
 const loader=new CollectionLoader(3,{request:request as unknown as typeof fetch,resolve,delayMs:0});
 await loader.resource('https://venue.example/start');expect(loader.requests).toBe(3);
 await expect(loader.resource('https://venue.example/other')).rejects.toBeInstanceOf(SourceBudgetExhausted);
 expect(request).toHaveBeenCalledTimes(3);
});
it('memoizes identical source GETs so separate field jobs do not redownload the homepage',async()=>{
 const request=jest.fn(async(url:URL)=>new Response(url.pathname==='/robots.txt'?'User-agent: *\nAllow: /':'menu',{headers:{'content-type':'text/html'}}));
 const loader=new CollectionLoader(20,{request:request as unknown as typeof fetch,resolve,delayMs:0});
 await Promise.all([loader.resource('https://venue.example/'),loader.resource('https://venue.example/')]);
 expect(loader.requests).toBe(2);expect(request).toHaveBeenCalledTimes(2);
});
it('checks every redirect DNS target and does not bypass robots or HTTP403',async()=>{
 const request=jest.fn(async(url:URL)=>url.pathname==='/robots.txt'?new Response('User-agent: *\nDisallow: /secret'):new Response('',{status:302,headers:{location:'https://private.example/menu'}}));
 const loader=new CollectionLoader(20,{request:request as unknown as typeof fetch,resolve:async host=>host==='private.example'?['10.0.0.1']:['8.8.8.8'],delayMs:0});
 await expect(loader.resource('https://venue.example/secret')).rejects.toBeInstanceOf(SourceBlocked);
 await expect(loader.resource('https://venue.example/menu')).rejects.toThrow('Non-public source address');
 await expect(loader.resource('https://127.0.0.1/menu')).rejects.toBeInstanceOf(SourceBlocked);
 const denied=new CollectionLoader(1,{request:async()=>new Response('',{status:403}),resolve,delayMs:0});
 await expect(denied.resource('https://venue.example/')).rejects.toBeInstanceOf(SourceBlocked);
});
it('bounds image bytes while reading actual dimensions from image headers',async()=>{
 const png=Buffer.alloc(300);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1200,16);png.writeUInt32BE(800,20);
 const loader=new CollectionLoader(2,{request:async()=>new Response(png,{headers:{'content-type':'image/png'}}),resolve,delayMs:0});
 const result=await loader.resource('https://venue.example/photo.png',{skipRobots:true,maxBody:40,partial:true});
 expect(result.body.length).toBe(40);expect(imageDimensions(result.body)).toEqual({width:1200,height:800});
 expect(imageDimensions(Buffer.from('<html>not an image</html>'))).toBeUndefined();
});
