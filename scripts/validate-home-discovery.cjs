/* Branch-only checks for Home photo identity, compact metadata, layout and navigation. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const OUT = path.resolve('polish-preview');
const ROOT = path.resolve('dist');
fs.mkdirSync(OUT, {recursive:true});
const report = {checks:[], geometry:[], errors:[]};
const near = (actual, expected, label, tolerance=1.1) => {
  assert.ok(Math.abs(actual-expected)<=tolerance, label+': '+actual+' vs '+expected);
};
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  let file;
  try { file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)); }
  catch {res.writeHead(400);res.end();return;}
  if (!file.startsWith(ROOT+path.sep) && file!==ROOT) {res.writeHead(403);res.end();return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file=path.join(ROOT,'index.html');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let browser;
let activePage;

async function dimensions(locator){
  return locator.evaluate(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {x:r.x,y:r.y,width:r.width,height:r.height,bg:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,shadow:s.boxShadow};
  });
}
async function checkOverflow(page,label){
  const value=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(value.document<=value.viewport+1,label+' no page overflow '+JSON.stringify(value));
}
async function screenshot(page,screen,theme,logImage=false){
  await page.screenshot({path:path.join(OUT,screen+'-'+theme+'.png'),fullPage:true});
  if(logImage){
    const jpeg=await page.screenshot({type:'jpeg',quality:68,fullPage:true});
    console.log('POLISH_QA_IMAGE '+screen+' '+theme+' '+jpeg.toString('base64'));
  }
}
async function main(){
 await new Promise(resolve=>server.listen(9876,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true});
 for(const theme of ['light','dark'])for(const hour of [8,19]){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,colorScheme:theme,timezoneId:'America/Los_Angeles',serviceWorkers:'block',ignoreHTTPSErrors:true});
  await context.addInitScript(({theme,hour})=>{
    localStorage.setItem('wayvee.arrival.v1','done');
    localStorage.setItem('wayvee.stay-onboarding.v1','skipped');
    localStorage.setItem('wayvee.appearance.v1',theme);
    localStorage.setItem('wayvee.city.v1','oakland');
    const OriginalDate=window.Date,originalNow=OriginalDate.now.bind(OriginalDate);
    const offset=new OriginalDate(2026,9,21,hour,30).getTime()-originalNow();
    window.Date=class extends OriginalDate{
      constructor(...args){if(args.length)super(...args);else super(originalNow()+offset);}
      static now(){return originalNow()+offset;}
    };
  },{theme,hour});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.hostname==='127.0.0.1'||method==='GET'||method==='HEAD')return route.continue();
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"Read-only preview"}'});
  });
  const page=activePage=await context.newPage();
  page.on('pageerror',err=>report.errors.push(theme+'/'+hour+': '+err.message));
  await page.goto('http://127.0.0.1:9876',{waitUntil:'domcontentloaded'});
  await page.getByText('Shall we wander?',{exact:true}).waitFor({timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return s.zIndex==='20'&&s.position==='absolute'&&r.width>100&&r.height>100&&s.display!=='none';
  }),null,{timeout:30000});
  await page.waitForFunction(()=>['eat','bars','routes'].every(key=>{
    const el=document.querySelector('[data-testid="home-tile-image-'+key+'"]');
    const img=el?.tagName==='IMG'?el:el?.querySelector('img');
    return img?.complete&&img.naturalWidth>0;
  }),null,{timeout:30000});
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});
    await page.waitForTimeout(100);
    await checkOverflow(page,theme+'/'+hour+'/'+width);
    for(const key of ['eat','bars','routes','events']){
      const frame=await dimensions(page.getByTestId('home-tile-mount-'+key));
      const tile=await dimensions(page.getByTestId('home-count-tile-'+key));
      near(frame.height,Math.round(tile.width*73/121),key+' preserved full-bleed ratio',.6);
      assert.notEqual(frame.shadow,'none','external tile elevation preserved');
      assert.equal(await page.getByTestId('home-tile-caption-'+key).count(),0,'external photo-only treatment preserved');
    }
  }
  await page.setViewportSize({width:390,height:844});
  await screenshot(page,'home-tiles-'+hour,theme,true);
  const ideas=page.getByTestId('home-ideas-preview').getByRole('button');
  assert.equal(await ideas.count(),3,'three vertical intentions');
  const first=hour===8?'Breakfast, then out':'Find a good dinner';
  assert.match(await ideas.first().getAttribute('aria-label'),new RegExp(first));
  assert.ok((await ideas.allTextContents()).every(text=>!text.includes('MUA Oakland')&&!text.includes('Highwire Coffee')));
  if(hour===8){
    assert.equal(await page.getByText('Worth getting up for',{exact:true}).count(),1);
    assert.equal(await page.getByText('Late night, still hungry',{exact:true}).count(),0);
  }else{
    assert.equal(await page.getByText('Worth getting up for',{exact:true}).count(),0);
    assert.equal(await page.getByText('Dinner before the show',{exact:true}).count(),1);
  }
  await page.getByTestId('home-ideas-preview').scrollIntoViewIfNeeded();
  await screenshot(page,'home-ideas-'+hour,theme,true);
  await ideas.first().click();
  await page.waitForURL(url=>url.pathname==='/featured'&&url.searchParams.get('q')===(hour===8?'breakfast':'dinner'),{timeout:15000});
  report.checks.push(theme+'/'+hour+': three clock-aware intentions open the correct food search');
  await page.goto('http://127.0.0.1:9876/collection',{waitUntil:'domcontentloaded'});
  await page.getByText('Shortlists for this part of the day.',{exact:true}).waitFor({timeout:15000});
  assert.equal(await page.getByText('Worth getting up for',{exact:true}).count(),hour===8?1:0);
  assert.equal(await page.getByText('Late night, still hungry',{exact:true}).count(),0);
  await checkOverflow(page,'Collections '+theme+'/'+hour);
  report.checks.push(theme+'/'+hour+': Collections See all shares the current time window');
  await context.close();
 }
 assert.deepEqual(report.errors,[],'no runtime exceptions');
 console.log('POLISH_QA_REPORT '+JSON.stringify(report));
}
main().catch(async err=>{
 report.failure=err.stack;
 if(activePage&&!activePage.isClosed()){
  try{
    await activePage.screenshot({path:path.join(OUT,'failure.png'),fullPage:true});
    const jpeg=await activePage.screenshot({type:'jpeg',quality:65,fullPage:true});
    console.log('POLISH_QA_IMAGE failure unknown '+jpeg.toString('base64'));
    console.log('POLISH_QA_DOM '+(await activePage.locator('body').innerText()).slice(0,12000));
  }catch{}
 }
 console.error(err);
 process.exitCode=1;
}).finally(async()=>{
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
 if(browser)await browser.close();
 server.close();
});
