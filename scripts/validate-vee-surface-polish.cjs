/* Temporary branch-only browser validation for the Vee surface update. */
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

async function tab(page,name){
  const locator=page.getByRole('tab',{name,exact:true}).filter({visible:true});
  await locator.last().click();
  await page.waitForTimeout(350);
}
async function checkGradients(page,label){
  const marks=await page.evaluate(()=>{
    const paths=[...document.querySelectorAll('svg path')].filter(p=>/^M(?:25\.4|27\.2) 16\.4/.test(p.getAttribute('d')||''));
    return paths.map(p=>{
      const stroke=p.getAttribute('stroke')||'';
      const id=stroke.match(/url\(#(.+)\)/)?.[1];
      const gradient=id?document.getElementById(id):null;
      return {stroke,id,local:!!gradient&&p.closest('svg').contains(gradient),
        colors:gradient?[...gradient.querySelectorAll('stop')].map(s=>s.getAttribute('stop-color')):[]};
    });
  });
  assert.ok(marks.length>0,label+' spiral present');
  assert.equal(new Set(marks.map(m=>m.id)).size,marks.length,label+' unique gradient ids');
  for(const mark of marks){
    assert.ok(mark.local,label+' local gradient exists');
    assert.deepEqual(mark.colors.map(c=>c.toUpperCase()),['#FFC757','#E85D2C','#6F5BD1','#FFC757']);
  }
  report.checks.push(label+': all '+marks.length+' spirals use original four-stop gradient');
}
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
async function spin(page){
  return page.getByTestId('vee-open-letter').getByTestId('vee-spin').evaluate(el=>getComputedStyle(el).transform);
}
async function main(){
 await new Promise(resolve=>server.listen(9876,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true});
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
    colorScheme:theme,timezoneId:'America/Los_Angeles',reducedMotion:'no-preference',serviceWorkers:'block',ignoreHTTPSErrors:true});
  await context.addInitScript(({theme})=>{
    localStorage.setItem('wayvee.arrival.v1','done');
    localStorage.setItem('wayvee.stay-onboarding.v1','skipped');
    localStorage.setItem('wayvee.appearance.v1',theme);
    localStorage.setItem('wayvee.city.v1','oakland');
    const OriginalDate=window.Date;
    const originalNow=OriginalDate.now.bind(OriginalDate);
    const offset=new OriginalDate(2026,9,20,8,30).getTime()-originalNow();
    window.Date=class extends OriginalDate {
      constructor(...args){if(args.length)super(...args);else super(originalNow()+offset);}
      static now(){return originalNow()+offset;}
    };
  },{theme});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.hostname==='127.0.0.1'||method==='GET'||method==='HEAD')return route.continue();
    if(method==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"Read-only visual preview"}'});
  });
  const page=activePage=await context.newPage();
  page.on('pageerror',err=>report.errors.push(theme+': '+err.message));
  await page.goto('http://127.0.0.1:9876',{waitUntil:'domcontentloaded'});
  await page.getByText('Shall we wander?',{exact:true}).waitFor({timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>{
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return s.zIndex==='20'&&s.position==='absolute'&&r.width>100&&r.height>100&&s.display!=='none';
  }),null,{timeout:15000});
  await page.waitForFunction(()=>['eat','bars','routes','events'].every(k=>{
    const frame=document.querySelector('[data-testid="home-tile-image-'+k+'"]');
    const img=frame?.tagName==='IMG'?frame:frame?.querySelector('img');
    return img?.complete&&img.naturalWidth>0;
  }),null,{timeout:30000});
  for(const width of [320,390,736]){
    await page.setViewportSize({width,height:844});
    await page.waitForTimeout(180);
    const expectedWidth=width===320?105:width===390?140:168;
    const tiles=[];
    for(const key of ['eat','bars','routes','events']){
      const frame=await dimensions(page.getByTestId('home-tile-window-'+key));
      near(frame.width,frame.height,theme+' '+width+' '+key+' square');
      near(frame.width,expectedWidth,theme+' '+width+' '+key+' retained width');
      const tile=await page.getByTestId('home-tile-window-'+key).evaluate(el=>{
        const button=el.closest('[role="button"]');
        const s=getComputedStyle(button);
        return {bg:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,shadow:s.boxShadow};
      });
      assert.equal(tile.bg,theme==='light'?'rgb(245, 240, 233)':'rgb(41, 37, 42)','tile matches Collections');
      assert.equal(tile.borderWidth,'1px');
      assert.ok(tile.shadow!=='none','tile raised');
      tiles.push({key,...frame,tile});
    }
    await checkOverflow(page,'Home '+theme+' '+width);
    report.geometry.push({screen:'Home',theme,width,tiles});
  }
  await page.setViewportSize({width:390,height:844});
  await checkGradients(page,'Home '+theme);
  const navigation=await dimensions(page.getByTestId('editorial-navigation').filter({visible:true}).last());
  assert.equal(navigation.borderWidth,'1px');
  assert.ok(navigation.shadow.includes('24.2px'),'navigation elevation +10%');
  report.geometry.push({screen:'Navigation',theme,...navigation});
  await screenshot(page,'home',theme,true);
  await tab(page,'Vee');
  await page.getByText('Where to?',{exact:true}).waitFor();
  await page.waitForTimeout(600);
  const composer=page.getByTestId('vee-composer-box');
  const box=await dimensions(composer);
  const input=page.getByTestId('vee-text-input');
  const field=await dimensions(input);
  near(field.height,105.6,'Vee input +20%',.5);
  assert.equal(field.borderWidth,'0px');
  assert.equal(box.borderWidth,'1px');
  for(const key of ['details','mic','send']){
    const control=await dimensions(page.getByTestId('vee-composer-'+key));
    assert.ok(control.x>=box.x&&control.x+control.width<=box.x+box.width+1,key+' inside horizontally');
    assert.ok(control.y>=box.y&&control.y+control.height<=box.y+box.height+1,key+' inside vertically');
    report.geometry.push({screen:'Vee '+key,theme,...control});
  }
  assert.equal(await page.getByTestId('vee-open-letter').getByText('Vee',{exact:true}).count(),0,'no redundant Vee text in hero');
  await checkOverflow(page,'Vee '+theme);
  await checkGradients(page,'Vee '+theme);
  const first=await spin(page);
  await page.waitForTimeout(650);
  const second=await spin(page);
  assert.notEqual(first,second,'Vee mark rotates on focused tab');
  report.checks.push(theme+': Vee focused spiral rotates');
  await page.getByTestId('vee-composer-mic').click();
  await input.evaluate(el=>{if(document.activeElement!==el)throw new Error('mic must focus input');});
  assert.equal(await input.evaluate(el=>getComputedStyle(el).outlineWidth),'0px','no rectangular focus border');
  await input.blur();
  await screenshot(page,'vee',theme,true);
  await page.getByTestId('vee-composer-details').click();
  await page.getByText('Add a constraint',{exact:true}).waitFor();
  await page.getByRole('button').filter({has:page.getByText('Nightcap',{exact:true})}).last().click();
  await page.getByText('Add a constraint',{exact:true}).waitFor({state:'hidden'});
  report.checks.push(theme+': Details opens working preference sheet');
  await page.getByTestId('vee-shapes-toggle').click();
  assert.equal(await page.getByTestId('vee-shapes-toggle').getAttribute('aria-expanded'),'true');
  await screenshot(page,'vee-shapes',theme);
  await page.getByTestId('vee-shapes-toggle').click();
  await input.fill('Fox Theater');
  await page.getByText('Ask Vee to plan around this',{exact:true}).waitFor();
  report.checks.push(theme+': live place search responds to typing');
  await input.fill('');
  await page.getByText('Where to?',{exact:true}).waitFor();
  await tab(page,'Home');
  const offscreen=page.getByTestId('vee-open-letter').getByTestId('vee-spin');
  if(await offscreen.count()){
    const off1=await offscreen.evaluate(el=>getComputedStyle(el).transform);
    await page.waitForTimeout(350);
    const off2=await offscreen.evaluate(el=>getComputedStyle(el).transform);
    assert.equal(off1,off2,'Vee rotation stops on tab blur');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await tab(page,'Vee');
  await page.waitForTimeout(500);
  const still1=await spin(page);
  await page.waitForTimeout(500);
  const still2=await spin(page);
  assert.equal(still1,still2,'reduced motion stops Vee rotation');
  report.checks.push(theme+': tab blur and reduced motion stop rotation');
  for(const name of ['Discover','You']){
    await tab(page,name);
    await page.waitForTimeout(500);
    await checkOverflow(page,name+' '+theme);
    await checkGradients(page,name+' '+theme);
    await screenshot(page,name==='You'?'profile':'discover',theme);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[],'no browser runtime exceptions');
 report.checks.push('Both themes and three viewport widths passed');
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
