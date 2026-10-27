import { createRequire } from 'node:module';
import { CollectionLoader,SourceBlocked } from './collection-loader';
import { SourceBudgetExhausted } from './detail-source-cache';

/** Browser dependency is installed in RUNNER_TEMP, never the native app.
 * All browser GETs are fulfilled through the SAME guarded/budgeted loader. */
export async function renderedMenu(url:string,loader:CollectionLoader):Promise<string|undefined>{
 const directory=process.env.MENU_PHOTO_BROWSER_ROOT;if(!directory)return;
 await loader.canRead(url);
 const require=createRequire(directory+'/package.json');
 const {chromium}=require('playwright') as {chromium:{launch:(options:unknown)=>Promise<any>}};
 const browser=await chromium.launch({headless:true,...(process.env.MENU_PHOTO_BROWSER_EXECUTABLE?{executablePath:process.env.MENU_PHOTO_BROWSER_EXECUTABLE}:{}),args:['--disable-background-networking','--disable-component-update','--disable-sync','--disable-quic','--dns-prefetch-disable','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});let sent=0,exhausted=false;
 try{
  const context=await browser.newContext({userAgent:'WayveeMenuPhotoSync/2.0 (+https://github.com/wayvee-main/001)',serviceWorkers:'block'});
  await context.routeWebSocket('**/*',(socket:any)=>socket.close());
  await context.addInitScript(()=>{
   for(const name of ['RTCPeerConnection','webkitRTCPeerConnection','WebTransport'])Object.defineProperty(globalThis,name,{value:undefined,configurable:false});
  });
  await context.route('**/*',async(route:any)=>{
   const request=route.request();
   if(request.method()!=='GET'||!['document','script','xhr','fetch'].includes(request.resourceType())||sent>=45){await route.abort();return;}
   try{sent++;const r=await loader.resource(request.url(),{accept:'text/html,application/json,text/javascript,application/javascript',maxBody:4_000_000});
    await route.fulfill({status:r.status,headers:{'content-type':r.contentType,'access-control-allow-origin':'*'},body:r.body});
   }catch(error){if(error instanceof SourceBudgetExhausted)exhausted=true;await route.abort();}
  });
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(4000);
  const html=await page.content();
  if(/verify (?:that )?you are human|checking (?:your )?browser|access denied|request blocked/i.test((await page.locator('body').innerText()).slice(0,5000)))throw new SourceBlocked('Browser source requires access challenge');
  if(exhausted)throw new SourceBudgetExhausted();return html;
 }finally{await browser.close();}
}
