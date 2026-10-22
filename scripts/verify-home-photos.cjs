const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const ROOT=path.resolve('dist'),OUT=path.resolve('home-photos-preview');fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);return res.end();}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file))file=fs.existsSync(file+'.html')?file+'.html':path.join(ROOT,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
let browser,page;const report={cards:[],errors:[]};
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1,label+': '+a+' vs '+b);
async function shot(name,theme){await page.screenshot({path:path.join(OUT,name+'-'+theme+'.png')});console.log('HOME_PHOTO_IMAGE '+name+' '+theme+' '+(await page.screenshot({type:'jpeg',quality:75})).toString('base64'));}
async function intro(){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.zIndex==='20'&&s.position==='absolute'&&r.width>100&&r.height>100&&s.display!=='none';}),null,{timeout:30000});}
async function photos(cards,label){
 const count=await cards.count();assert.ok(count>0,label+' has cards');
 for(const card of await cards.all()){
  await card.scrollIntoViewIfNeeded();
  await card.locator('img').first().waitFor({timeout:30000});
  await card.locator('img').first().evaluate(img=>new Promise((resolve,reject)=>{if(img.complete)return img.naturalWidth?resolve():reject(Error('Image failed: '+img.src));const t=setTimeout(()=>reject(Error('Image timeout: '+img.src)),30000);img.addEventListener('load',()=>{clearTimeout(t);resolve();},{once:true});img.addEventListener('error',()=>{clearTimeout(t);reject(Error('Image failed: '+img.src));},{once:true});}));
  const box=await card.boundingBox();near(box.height,83,label+' height');
  const data=await card.evaluate(el=>{const img=el.querySelector('img');return {title:el.getAttribute('aria-label'),uri:img.currentSrc||img.src,loaded:img.naturalWidth>0};});
  assert.ok(!/unsplash|pexels|pixabay|wikimedia/.test(data.uri),'No generic stock thumbnail');
  report.cards.push({label,...data});
 }
}
async function main(){
 await new Promise(resolve=>server.listen(9876,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const theme of ['light','dark'])for(const hour of [8,12,15,19,23]){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,colorScheme:theme,timezoneId:'America/Los_Angeles',serviceWorkers:'block',ignoreHTTPSErrors:true});
  await context.addInitScript(({theme,hour})=>{
   localStorage.setItem('wayvee.arrival.v1','done');localStorage.setItem('wayvee.stay-onboarding.v1','skipped');localStorage.setItem('wayvee.appearance.v1',theme);localStorage.setItem('wayvee.city.v1','oakland');
   const D=window.Date,now=D.now.bind(D),offset=new D(2026,9,21,hour,30).getTime()-now();window.Date=class extends D{constructor(...args){if(args.length)super(...args);else super(now()+offset)}static now(){return now()+offset}};
  },{theme,hour});
  await context.route('**/*',async route=>{const req=route.request(),method=req.method(),url=new URL(req.url());if(url.hostname==='127.0.0.1'||method==='GET'||method==='HEAD')return route.continue();if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"Read-only preview"}'});});
  page=await context.newPage();page.on('pageerror',err=>report.errors.push(err.message));await page.goto('http://127.0.0.1:9876',{waitUntil:'domcontentloaded'});await page.getByText('Shall we wander?',{exact:true}).waitFor({timeout:60000});await intro();
  const bg=theme==='light'?'rgb(231, 224, 214)':'rgb(16, 13, 19)';for(const id of ['home-evening-ribbon','home-stay-chip'])assert.equal(await page.getByTestId(id).evaluate(el=>getComputedStyle(el).backgroundColor),bg,'Retained '+id+' color');
  const ideas=page.getByTestId('home-ideas-preview').getByRole('button');assert.equal(await ideas.count(),3);
  await photos(ideas,theme+'-'+hour+'-ideas');
  const collections=page.locator('[role="button"][data-testid^="home-collection-"]');await photos(collections,theme+'-'+hour+'-collections');
  const title=(await collections.first().getAttribute('aria-label')).split('. ')[0];
  if(hour===8||hour===19){await ideas.first().scrollIntoViewIfNeeded();await shot('home-'+hour,theme);}
  if(hour===8){
   for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    for(const key of ['eat','bars','routes','events']){const tile=page.getByTestId('home-count-tile-'+key);assert.equal(await tile.locator('img').count(),0);assert.equal(await tile.evaluate(el=>getComputedStyle(el).backgroundColor),theme==='light'?'rgb(255, 252, 248)':'rgb(41, 37, 42)');}
   }
   await page.setViewportSize({width:390,height:844});
   await page.goto('http://127.0.0.1:9876/home/ideas',{waitUntil:'domcontentloaded'});await page.getByTestId('home-idea-list-breakfast').waitFor({timeout:60000});await intro();await photos(page.locator('[role="button"][data-testid^="home-idea-list-"]'),'See all ideas '+theme);
   await page.goto('http://127.0.0.1:9876/home/collections',{waitUntil:'domcontentloaded'});const list=page.locator('[role="button"][data-testid^="home-collection-list-"]');await list.first().waitFor({timeout:60000});await intro();await photos(list,'See all collections '+theme);await shot('collection-list',theme);await list.first().click();await page.waitForURL(/\/home\/collection\?id=/);await page.getByTestId('home-field-guide').last().waitFor();
   await page.goto('http://127.0.0.1:9876/home/browse?category=all&q='+encodeURIComponent(title),{waitUntil:'domcontentloaded'});const lead=page.getByTestId('home-guide-lead');await lead.waitFor({timeout:60000});await lead.locator('img').first().waitFor({timeout:30000});assert.ok(await lead.locator('img').first().evaluate(img=>new Promise(resolve=>{if(img.complete)return resolve(img.naturalWidth>0);img.onload=()=>resolve(true);img.onerror=()=>resolve(false)})),'Collection search loads photo');
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('HOME_PHOTO_REPORT '+JSON.stringify(report));
}
main().catch(async err=>{report.failure=err.stack;if(page&&!page.isClosed()){try{await shot('failure','unknown');console.log('HOME_PHOTO_DOM '+(await page.locator('body').innerText()).slice(0,5000));}catch{}}console.error(err);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();});
