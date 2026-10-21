/* Branch-only visual checks; kept out of the production commit. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve('dist'),OUT=path.resolve('polish-preview');
fs.mkdirSync(OUT,{recursive:true});
const report={checks:[],geometry:[],errors:[]};
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1,label+': '+a+' vs '+b);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 let file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=fs.existsSync(file+'.html')?file+'.html':path.join(ROOT,'index.html');
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let browser,activePage;
async function shot(page,name,theme,emit=false){
 await page.screenshot({path:path.join(OUT,name+'-'+theme+'.png'),fullPage:true});
 if(emit)console.log('POLISH_QA_IMAGE '+name+' '+theme+' '+(await page.screenshot({type:'jpeg',quality:68,fullPage:true})).toString('base64'));
}
async function noOverflow(page,label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' no document overflow');}
async function goto(page,url){
 await page.goto('http://127.0.0.1:9876'+url,{waitUntil:'domcontentloaded'});
 await page.getByTestId('app-background-gradient').first().waitFor({timeout:60000});
 await page.getByRole('tablist').first().waitFor({timeout:60000});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.zIndex==='20'&&s.position==='absolute'&&r.width>100&&r.height>100&&s.display!=='none';
 }),null,{timeout:30000});
}
async function guideReady(page){await page.getByTestId('home-field-guide').waitFor({timeout:20000});await noOverflow(page,'Field Guide');}
async function main(){
 await new Promise(resolve=>server.listen(9876,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const theme of ['light','dark'])for(const hour of [8,19]){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,colorScheme:theme,timezoneId:'America/Los_Angeles',serviceWorkers:'block',ignoreHTTPSErrors:true});
  await context.addInitScript(({theme,hour})=>{
   localStorage.setItem('wayvee.arrival.v1','done');localStorage.setItem('wayvee.stay-onboarding.v1','skipped');localStorage.setItem('wayvee.appearance.v1',theme);localStorage.setItem('wayvee.city.v1','oakland');
   const OriginalDate=window.Date,originalNow=OriginalDate.now.bind(OriginalDate),offset=new OriginalDate(2026,9,21,hour,30).getTime()-originalNow();
   window.Date=class extends OriginalDate{constructor(...args){if(args.length)super(...args);else super(originalNow()+offset);}static now(){return originalNow()+offset;}};
  },{theme,hour});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),method=req.method();if(url.hostname==='127.0.0.1'||method==='GET'||method==='HEAD')return route.continue();
   if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"Read-only preview"}'});
  });
  const page=activePage=await context.newPage();page.on('pageerror',err=>report.errors.push(theme+'/'+hour+': '+err.message));
  await goto(page,'/');await page.getByText('Shall we wander?',{exact:true}).waitFor();
  const ideas=page.getByTestId('home-ideas-preview').getByRole('button');assert.equal(await ideas.count(),3);
  assert.match(await ideas.first().getAttribute('aria-label'),hour===8?/Breakfast, then out/:/Find a good dinner/);
  const collections=page.locator('[data-testid^="home-collection-"]');assert.ok(await collections.count()>0);
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(100);await noOverflow(page,'Home '+width);
   const ideaHeight=(await ideas.first().boundingBox()).height,collectionHeight=(await collections.first().boundingBox()).height;
   near(ideaHeight,83,'For you height');near(collectionHeight,ideaHeight,'Collections same height');
   for(const key of ['eat','bars','routes','events']){
    const mount=page.getByTestId('home-tile-mount-'+key),box=await mount.boundingBox();near(box.height,Math.round(box.width*73/121),'tile geometry');
    assert.equal(await mount.locator('img').count(),0,'glyphs replace photographs');
    assert.equal(await page.getByTestId('home-tile-illustration-'+key).count(),1);
    const textStyle=await page.getByTestId('home-tile-title-'+key).evaluate(el=>{const s=getComputedStyle(el);return {size:s.fontSize,line:s.lineHeight,spacing:s.letterSpacing,font:s.fontFamily};});
    assert.equal(textStyle.size,'17px');near(parseFloat(textStyle.line),19.55,'preserved title lineheight');assert.match(textStyle.font,/Fraunces/);
    const countStyle=await page.getByTestId('home-tile-count-'+key).evaluate(el=>getComputedStyle(el).fontSize);assert.equal(countStyle,'13px');
   }
   report.geometry.push({theme,hour,width,ideaHeight,collectionHeight});
  }
  await page.setViewportSize({width:390,height:844});await page.getByText('Shall we wander?',{exact:true}).scrollIntoViewIfNeeded();await shot(page,'home-'+hour,theme,hour===8);
  await collections.first().scrollIntoViewIfNeeded();await shot(page,'home-cards-'+hour,theme,hour===8);
  await ideas.first().click();await page.waitForURL(url=>url.pathname==='/home/ideas'&&url.searchParams.get('idea')===(hour===8?'breakfast':'dinner'));await guideReady(page);
  assert.ok(await page.getByTestId('home-guide-lead').count()>0,'intent has sourced results');await shot(page,'field-guide-'+hour,theme,hour===8);
  await page.getByRole('button',{name:/Take a closer look at/}).click();await page.waitForURL(/\/home\/detail\?/);await guideReady(page);await page.getByTestId('home-guide-save').waitFor();
  assert.equal(await page.getByRole('link',{name:'Directions'}).count(),1);await shot(page,'detail-'+hour,theme,hour===8);
  await page.getByTestId('home-guide-save').click();await page.getByText('Sign in',{exact:true}).first().waitFor({timeout:10000});
  report.checks.push(theme+'/'+hour+': idea → Field Guide → detail preserves source links and sign-in gate');
  await goto(page,'/home/collections');await guideReady(page);const shortlist=page.getByRole('button').filter({hasText:hour===8?'Worth getting up for':'Dinner before the show'}).first();await shortlist.click();await page.waitForURL(/\/home\/collection\?/);await guideReady(page);assert.ok(await page.getByTestId('home-guide-lead').count()>0);await shot(page,'collection-'+hour,theme);
  for(const category of ['eat','bars','routes','events']){
   await goto(page,'/');await page.getByTestId('home-count-tile-'+category).click();await page.waitForURL(url=>url.pathname==='/home/browse'&&url.searchParams.get('category')===category);await guideReady(page);
   await page.getByRole('header',{name:{eat:'Eat',bars:'Bars',routes:'Routes',events:'Events'}[category],exact:true}).waitFor();
   if(category!=='events')assert.ok(await page.getByTestId('home-guide-lead').count()>0);
  }
  await goto(page,'/home/ideas?idea=fresh-air');await guideReady(page);await page.getByRole('button',{name:/Take a closer look at/}).click();await page.waitForURL(/\/home\/detail\?/);await page.getByRole('link',{name:'Park information & updates'}).waitFor();assert.equal(await page.getByTestId('home-guide-save').count(),0);
  await goto(page,'/');await page.getByRole('button',{name:'Search the city of Oakland',exact:true}).click();await page.waitForURL(/\/home\/browse\?category=all/);await page.getByTestId('home-guide-search').fill('MUA');await page.getByTestId('home-guide-lead').waitFor();
  await page.getByTestId('home-guide-search').fill('unmatchable-not-a-real-place');await page.getByText('Nothing here just yet',{exact:true}).waitFor();
  await goto(page,'/home/detail?kind=place&id=missing');await page.getByText('No current listing',{exact:true}).waitFor();
  await goto(page,'/discover');await page.getByRole('tab',{name:'Discover',exact:true}).waitFor();assert.equal(await page.getByTestId('home-field-guide').count(),0);await shot(page,'discover-unchanged-'+hour,theme);
  report.checks.push(theme+'/'+hour+': every category, collection, outdoors, search, missing entry and Discover navigation passes');
  await context.close();
 }
 assert.deepEqual(report.errors,[],'no runtime exceptions');console.log('POLISH_QA_REPORT '+JSON.stringify(report));
}
main().catch(async err=>{
 report.failure=err.stack;if(activePage&&!activePage.isClosed()){try{await shot(activePage,'failure','unknown',true);console.log('POLISH_QA_DOM '+(await activePage.locator('body').innerText()).slice(0,12000));}catch{}}
 console.error(err);process.exitCode=1;
}).finally(async()=>{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();});
