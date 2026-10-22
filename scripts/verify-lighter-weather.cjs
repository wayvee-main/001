// Two-step lighter paper: #FFFCF3 in light mode; dark remains unchanged.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const ROOT=path.resolve('dist'),OUT=path.resolve('cream-controls-preview');fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);return res.end();}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file))file=fs.existsSync(file+'.html')?file+'.html':path.join(ROOT,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
let browser,page;const report={cards:[],errors:[]};
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1,label+': '+a+' vs '+b);
async function shot(name,theme){await page.screenshot({path:path.join(OUT,name+'-'+theme+'.png')});console.log('CREAM_QA_IMAGE '+name+' '+theme+' '+(await page.screenshot({type:'jpeg',quality:75})).toString('base64'));}
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
 report.screens=[];
 const style=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {bg:s.backgroundColor,border:s.borderColor,borderWidth:s.borderTopWidth,radius:s.borderRadius,shadow:s.boxShadow,x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,size:s.fontSize,paddingLeft:s.paddingLeft,paddingRight:s.paddingRight};};
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,colorScheme:theme,timezoneId:'America/Los_Angeles',serviceWorkers:'block',ignoreHTTPSErrors:true});
  await context.addInitScript(theme=>{localStorage.setItem('wayvee.arrival.v1','done');localStorage.setItem('wayvee.stay-onboarding.v1','skipped');localStorage.setItem('wayvee.appearance.v1',theme);localStorage.setItem('wayvee.city.v1','oakland');},theme);
  await context.route('**/*',async route=>{const req=route.request(),method=req.method(),url=new URL(req.url());if(url.hostname==='127.0.0.1'||method==='GET'||method==='HEAD')return route.continue();if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"Read-only preview"}'});});
  page=await context.newPage();page.on('pageerror',err=>report.errors.push(err.message));
  await page.goto('http://127.0.0.1:9876',{waitUntil:'domcontentloaded'});await page.getByText('Shall we wander?',{exact:true}).waitFor({timeout:60000});await intro();
  await page.getByTestId('home-weather').waitFor({timeout:60000});
  const weather=await page.getByTestId('home-weather').textContent();assert.match(weather,/\d+°/,'Sourced current weather rendered');
  const homeTitle=await page.getByTestId('home-header').getByText('Wayvee',{exact:true}).evaluate(style);
  const homeSearch=await page.getByTestId('home-search').evaluate(style);
  const homeText=await page.getByTestId('home-search-label').evaluate(style);
  const chip=page.getByTestId(/^home-quick-chip-/).first();await chip.waitFor();const homeChip=await chip.evaluate(style),chipText=await chip.locator('div').last().evaluate(style);
  assert.equal(homeChip.bg,theme==='light'?'rgb(255, 252, 248)':'rgb(41, 37, 42)','Home venue chip retained');
  const cardBg=theme==='light'?'rgb(255, 252, 243)':'rgb(41, 37, 42)';
  for(const id of ['home-evening-ribbon','home-stay-chip']){
   const s=await page.getByTestId(id).evaluate(style);assert.equal(s.bg,theme==='light'?cardBg:'rgb(16, 13, 19)');assert.equal(s.borderWidth,'1px');assert.equal(s.border,theme==='light'?'rgba(49, 32, 57, 0.06)':'rgba(250, 242, 232, 0.04)');
  }
  for(const card of await page.getByTestId('home-ideas-preview').getByRole('button').all()){assert.equal((await card.evaluate(style)).bg,cardBg);near((await card.boundingBox()).height,83,'Compact For you');assert.ok(await card.locator('img').count());}
  for(const card of await page.locator('[role="button"][data-testid^="home-collection-"]').all())assert.equal((await card.evaluate(style)).bg,cardBg);
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(const key of ['eat','bars','routes','events']){const s=await page.getByTestId('home-count-tile-'+key).evaluate(style);assert.equal(s.bg,theme==='light'?'rgb(255, 252, 248)':'rgb(41, 37, 42)');}}
  await page.setViewportSize({width:390,height:844});await shot('home',theme);

  await page.goto('http://127.0.0.1:9876/discover',{waitUntil:'domcontentloaded'});await page.getByTestId('discover-title').waitFor({timeout:60000});await intro();
  const title=await page.getByTestId('discover-title').evaluate(style),city=await page.getByTestId('discover-city').evaluate(style),search=await page.getByTestId('discover-search').evaluate(style),input=page.getByTestId('discover-search-input'),inputStyle=await input.evaluate(style);
  near(title.x,homeTitle.x,'Header left edge');near(title.y,homeTitle.y,'Header top edge');assert.equal(title.font,homeTitle.font);assert.equal(title.size,homeTitle.size);assert.ok(city.y>=title.y+title.height);assert.equal(await page.getByTestId('discover-city').textContent(),'Oakland');
  for(const key of ['bg','border','borderWidth','radius','shadow','paddingLeft','paddingRight'])assert.equal(search[key],homeSearch[key],'Shared search '+key);near(search.height,homeSearch.height,'Shared search height');assert.equal(inputStyle.font,homeText.font);assert.equal(inputStyle.size,homeText.size);
  const inactive=await page.getByTestId('discover-chip-food').evaluate(style);for(const key of ['bg','border','borderWidth','radius','shadow','paddingLeft','paddingRight'])assert.equal(inactive[key],homeChip[key],'Shared chip '+key);near(inactive.height,homeChip.height,'Shared chip height');
  for(const card of await page.locator('[role="button"][data-testid^="trail-"],[role="button"][data-testid^="field-route-"],[role="button"][data-testid^="field-room-"]').all())assert.equal((await card.evaluate(style)).bg,cardBg,'Discover default card material');
  await shot('discover',theme);await input.fill('mua');await page.getByText('Matches for “mua”',{exact:true}).waitFor();await page.getByRole('button',{name:'Clear search',exact:true}).click();await page.getByTestId('discover-chip-nightlife').click();assert.equal((await page.getByTestId('discover-chip-nightlife').evaluate(style)).bg,theme==='light'?'rgb(43, 28, 53)':'rgb(41, 25, 46)','Active filter material');await page.getByTestId('discover-chip-all').click();

  await page.goto('http://127.0.0.1:9876/create',{waitUntil:'domcontentloaded'});const toggle=page.getByTestId('vee-shapes-toggle');await toggle.waitFor({timeout:60000});await intro();await page.getByTestId('vee-shape-card').first().waitFor({timeout:30000});
  const other=page.getByTestId('vee-other-options');await other.waitFor();
  for(const action of [toggle,other]){const s=await action.evaluate(style);assert.equal(s.bg,'rgba(0, 0, 0, 0)');assert.equal(s.borderWidth,'0px');assert.equal(s.shadow,'none');assert.equal(await action.locator('svg').count(),0);near(s.x,homeTitle.x,'Plain action aligns left');assert.ok(s.height>=44);}
  assert.ok(await page.getByTestId('vee-shape-card').count()>0,'Shapes are open initially');for(const card of await page.getByTestId('vee-shape-card').all())assert.equal((await card.evaluate(style)).bg,cardBg,'Shape cards retain containment');
  await toggle.scrollIntoViewIfNeeded();await shot('vee',theme);await toggle.click();assert.equal(await page.getByTestId('vee-shape-card').count(),0);await toggle.click();await page.getByTestId('vee-shape-card').first().waitFor();await other.click();await page.getByTestId('vee-shape-card').first().waitFor();
  report.screens.push({theme,weather,homeTitle,discoverTitle:title,homeSearch,discoverSearch:search,homeChip,discoverChip:inactive});await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('CREAM_QA_REPORT '+JSON.stringify(report));
}
main().catch(async err=>{report.failure=err.stack;if(page&&!page.isClosed()){try{await shot('failure','unknown');console.log('CREAM_QA_DOM '+(await page.locator('body').innerText()).slice(0,5000));}catch{}}console.error(err);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();});
