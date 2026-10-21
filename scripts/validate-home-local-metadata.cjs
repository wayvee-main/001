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
  }),null,{timeout:45000});

  const ribbonAccent=await page.getByTestId('home-evening-ribbon').evaluate(el=>getComputedStyle(el.lastElementChild.querySelector('svg')).stroke);
  for(const width of [320,390,430,736]){
    await page.setViewportSize({width,height:844});
    await page.waitForTimeout(160);
    const expectedWidth=Math.min(width,720)-(width<=400?30:34)*2;
    const expectedCard=(expectedWidth-16)/2;
    const grid=await dimensions(page.getByTestId('around-you-grid'));
    near(grid.width,expectedWidth,'grid fills content',.5);
    const tiles=[];
    for(const key of ['eat','bars','routes','events']){
      const tile=await page.getByTestId('home-count-tile-'+key).evaluate((button,key)=>{
        const metric=el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          return {x:r.x,y:r.y,width:r.width,height:r.height,bg:s.backgroundColor,border:s.borderWidth,radius:s.borderRadius,shadow:s.boxShadow,font:s.fontFamily,size:s.fontSize,line:s.lineHeight};
        };
        const find=name=>button.querySelector('[data-testid="home-tile-'+name+'-'+key+'"]');
        const mount=find('mount'),outline=mount.firstElementChild;
        const svg=find('chevron').querySelector('svg'),is=getComputedStyle(svg);
        return {root:metric(button),mount:metric(mount),photo:metric(find('window')),caption:metric(find('caption')),
          title:metric(find('title')),count:metric(find('count')),chevron:metric(find('chevron')),
          description:metric(find('description')),facts:metric(find('facts')),
          heading:metric(find('heading')),captionChildren:find('caption').children.length,
          descriptionText:find('description').textContent,factsText:find('facts').textContent,factCount:find('facts').children.length,
          padding:{top:getComputedStyle(mount).paddingTop,right:getComputedStyle(mount).paddingRight,bottom:getComputedStyle(mount).paddingBottom,left:getComputedStyle(mount).paddingLeft},
          outline:getComputedStyle(outline).borderWidth,icon:{stroke:is.stroke,fill:is.fill},
          bodyChildren:button.children.length,value:find('count').textContent,label:button.getAttribute('aria-label')};
      },key);
      near(tile.root.width,expectedCard,key+' half-row width',.5);
      assert.equal(tile.root.bg,'rgba(0, 0, 0, 0)',key+' entire tile is uncontained');
      assert.equal(tile.root.shadow,'none',key+' entire tile has no shadow');
      assert.equal(tile.root.border,'0px');
      assert.equal(tile.bodyChildren,2,'photo frame and caption only');
      assert.equal(tile.mount.bg,theme==='light'?'rgb(245, 240, 233)':'rgb(41, 37, 42)');
      assert.notEqual(tile.mount.shadow,'none',key+' only photo is raised');
      assert.equal(tile.mount.border,'0px');
      assert.equal(tile.mount.radius,'12px');
      assert.equal(tile.outline,'1px','faint frame overlay');
      for(const edge of ['top','right','bottom','left'])assert.equal(tile.padding[edge],'8px',key+' '+edge+' padding');
      near(tile.mount.width,tile.root.width,'frame fills tile',.5);
      near(tile.photo.x-tile.mount.x,8,'photo left inset',.4);
      near(tile.photo.y-tile.mount.y,8,'photo top inset',.4);
      near(tile.mount.x+tile.mount.width-tile.photo.x-tile.photo.width,8,'photo right inset',.4);
      near(tile.mount.y+tile.mount.height-tile.photo.y-tile.photo.height,8,'photo bottom inset',.4);
      near(tile.photo.height,tile.photo.width*73/121,'established photo ratio',.5);
      assert.equal(tile.caption.bg,'rgba(0, 0, 0, 0)','caption shows original page gradient');
      assert.equal(tile.caption.border,'0px');
      assert.equal(tile.caption.shadow,'none');
      near(tile.caption.y-tile.mount.y-tile.mount.height,7,'caption gap',.4);
      near(tile.title.x-tile.root.x,8,'caption aligns with photo inset',.4);
      near(tile.count.x-tile.title.x-tile.title.width,6,'count immediately beside category',.5);
      assert.ok(Math.abs(tile.title.y-tile.count.y)<5,'category and count share baseline');
      assert.equal(tile.title.size,'17px');
      assert.equal(tile.count.size,'13px');
      assert.match(tile.value,/^\d+$/,'count remains real inventory');
      assert.match(tile.label,new RegExp('^Explore '+tile.value+' '),'accessible count and category');
      assert.equal(tile.icon.fill,'none','outline chevrons retained');
      assert.equal(tile.icon.stroke,ribbonAccent,'same orange as the Home ribbon');
      near(tile.chevron.x+tile.chevron.width,tile.root.x+tile.root.width-8,'chevron right alignment',.4);
      assert.ok(tile.count.x+tile.count.width<=tile.chevron.x-7,'text does not collide with chevron');
      near(tile.root.height,tile.mount.height+7+tile.caption.height,'content-fit compact tile',.6);
      assert.equal(tile.captionChildren,3,'heading and exactly two additional rows');
      near(tile.description.y-tile.heading.y-tile.heading.height,5,'description gap',.6);
      near(tile.facts.y-tile.description.y-tile.description.height,8,'facts gap',.6);
      assert.ok(tile.factCount>=1&&tile.factCount<=2,'one or two useful facts');
      assert.equal(tile.description.size,'11px');
      assert.ok(tile.description.height<18,'description stays on one line');
      assert.ok(tile.facts.height<18,'facts stay inline');
      assert.ok(tile.factsText.length>0);
      if(key==='eat'){assert.equal(tile.descriptionText,'MUA Oakland');assert.match(tile.factsText,/\$\$/);}
      if(key==='bars'){assert.equal(tile.descriptionText,'Little Bird');assert.match(tile.factsText,/2 AM/);}
      if(key==='routes'){assert.equal(tile.descriptionText,'Uptown cocktails & hi-fi');assert.match(tile.factsText,/3 stops/);}
      tiles.push({key,...tile});
    }
    near(tiles[1].root.x+tiles[1].root.width,grid.x+grid.width,'right column fills row',.5);
    near(tiles[1].root.x-tiles[0].root.x-tiles[0].root.width,16,'column gap',.5);
    near(tiles[2].root.y-tiles[0].root.y-tiles[0].root.height,16,'row gap',.5);
    await checkOverflow(page,'Home '+theme+' '+width);
    report.geometry.push({theme,width,grid,tiles});
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(1000);
  assert.equal(await page.getByTestId('home-tile-count-bars').innerText(),'10');
  assert.equal(await page.getByTestId('home-tile-count-routes').innerText(),'3');
  await screenshot(page,'local-metadata',theme,true);
  report.checks.push(theme+': two compact metadata rows, matching local picks, transparent captions, equal photo insets, inline counts and outline orange chevrons at 320/390/430/736px');
  if(theme==='light'){
    const targets=[
      {key:'eat',part:'home-tile-window-eat',path:'/featured',mode:null},
      {key:'bars',part:'home-tile-caption-bars',path:'/discover',mode:'Nightlife'},
      {key:'routes',part:'home-count-tile-routes',path:'/discover',mode:'Routes'},
      {key:'events',part:'home-count-tile-events',path:'/discover',mode:'Events'},
    ];
    for(const target of targets){
      await page.getByTestId(target.part).filter({visible:true}).click();
      await page.waitForURL(url=>url.pathname===target.path&&(!target.mode||url.searchParams.get('mode')===target.mode),{timeout:15000});
      report.checks.push('Tap '+target.key+' opens its real destination from photo/caption/tile');
      await page.goto('http://127.0.0.1:9876',{waitUntil:'domcontentloaded'});
      await page.getByText('Shall we wander?',{exact:true}).waitFor();
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(250);
    }
    const imageUrl=await page.getByTestId('home-tile-image-eat').evaluate(el=>(el.tagName==='IMG'?el:el.querySelector('img')).currentSrc);
    await page.route(url=>url.href===imageUrl,route=>route.abort());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('home-tile-fallback-eat').waitFor({timeout:30000});
    assert.equal(await page.getByTestId('home-tile-title-eat').innerText(),'Eat');
    assert.match(await page.getByTestId('home-tile-count-eat').innerText(),/^\d+$/);
    const mount=await dimensions(page.getByTestId('home-tile-mount-eat'));
    const fallback=await dimensions(page.getByTestId('home-tile-window-eat'));
    near(mount.height,fallback.height+16,'failed image keeps the same frame geometry',.5);
    report.checks.push('Failed photo retains raised frame, category glyph, label, count and action');
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[],'no browser runtime exceptions');
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
