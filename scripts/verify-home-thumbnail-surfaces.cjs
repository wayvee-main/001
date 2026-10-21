const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const ROOT=path.resolve('dist'),OUT=path.resolve('home-surfaces-preview');fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let file=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);return res.end();}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file))file=fs.existsSync(file+'.html')?file+'.html':path.join(ROOT,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
let browser,page;const report={geometry:[],errors:[]};
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1,label+': '+a+' vs '+b);
async function shot(name,theme,locator){await (locator||page).screenshot({path:path.join(OUT,name+'-'+theme+'.png')});console.log('RESTORED_TILE_IMAGE '+name+' '+theme+' '+(await (locator||page).screenshot({type:'jpeg',quality:75})).toString('base64'));}
async function main(){
 await new Promise(resolve=>server.listen(9876,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,colorScheme:theme,timezoneId:'America/Los_Angeles',serviceWorkers:'block',ignoreHTTPSErrors:true});
  await context.addInitScript(theme=>{localStorage.setItem('wayvee.arrival.v1','done');localStorage.setItem('wayvee.stay-onboarding.v1','skipped');localStorage.setItem('wayvee.appearance.v1',theme);localStorage.setItem('wayvee.city.v1','oakland');},theme);
  await context.route('**/*',async route=>{const req=route.request(),method=req.method(),url=new URL(req.url());if(url.hostname==='127.0.0.1'||method==='GET'||method==='HEAD')return route.continue();if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"Read-only preview"}'});});
  page=await context.newPage();page.on('pageerror',err=>report.errors.push(err.message));await page.goto('http://127.0.0.1:9876',{waitUntil:'domcontentloaded'});await page.getByText('Shall we wander?',{exact:true}).waitFor({timeout:60000});await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.zIndex==='20'&&s.position==='absolute'&&r.width>100&&r.height>100&&s.display!=='none';}),null,{timeout:30000});
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(100);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
   const boxes=[];
   for(const [key,hint] of Object.entries({eat:'Nearby places',bars:'After dinner',routes:'A few good stops',events:'Find your next show'})){
    const card=page.getByTestId('home-count-tile-'+key),box=await card.boundingBox(),glyph=await page.getByTestId('home-tile-glyph-'+key).boundingBox(),count=await page.getByTestId('home-tile-count-'+key).boundingBox(),title=await page.getByTestId('home-tile-title-'+key).boundingBox();boxes.push(box);
    near(glyph.width,28,'Small glyph circle');near(glyph.height,28,'Round glyph well');assert.ok(count.x>glyph.x+glyph.width,'Count at top right');assert.ok(title.y>glyph.y+glyph.height,'Category below glyph');assert.ok(box.height>=100&&box.height<=121,'Compact card height');
    const style=await card.evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,radius:s.borderRadius,border:s.borderWidth,shadow:s.boxShadow};});assert.equal(style.bg,theme==='light'?'rgb(255, 252, 248)':'rgb(41, 37, 42)');assert.equal(style.radius,'22px');assert.equal(style.border,'1px');assert.notEqual(style.shadow,'none');
    assert.equal(await page.getByTestId('home-tile-caption-'+key).textContent(),hint);assert.equal(await card.locator('img').count(),0);
   }
   near(boxes[1].x-boxes[0].x-boxes[0].width,10,'Horizontal gap');near(boxes[2].y-boxes[0].y-boxes[0].height,10,'Vertical gap');near(boxes[0].width,boxes[1].width,'Equal columns');near(boxes[0].height,boxes[1].height,'Equal first row heights');near(boxes[2].height,boxes[3].height,'Equal second row heights');
   const gutter=width<=400?30:34;near(boxes[0].x,gutter,'Left app gutter');near(boxes[1].x+boxes[1].width,width-gutter,'Right app gutter');
   const ideas=page.getByTestId('home-ideas-preview').getByRole('button');assert.equal(await ideas.count(),3);near((await ideas.first().boundingBox()).height,83,'For you unchanged');const collection=page.locator('[data-testid^="home-collection-"]').first();if(await collection.count())near((await collection.boundingBox()).height,83,'Collections unchanged');

   const firstIdea=page.getByTestId('home-ideas-preview').getByRole('button').first();
   const firstIdeaId=await firstIdea.getAttribute('data-testid');
   const thumb=page.getByTestId(firstIdeaId+'-glyph');
   const thumbBg=await thumb.evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(thumbBg,theme==='light'?'rgb(231, 224, 214)':'rgb(16, 13, 19)');
   for(const id of ['home-evening-ribbon','home-stay-chip'])assert.equal(await page.getByTestId(id).evaluate(el=>getComputedStyle(el).backgroundColor),thumbBg,id+' matches For you thumbnail');
   const collectionCards=page.locator('[role="button"][data-testid^="home-collection-"]');
   assert.ok(await collectionCards.count()>0);
   for(const card of await collectionCards.all()){
    assert.equal(await card.locator('img').count(),0,'Collection uses glyph, not cover image');
    const id=await card.getAttribute('data-testid'),well=page.getByTestId(id+'-glyph');
    assert.equal(await well.locator('svg').count(),1,'Collection glyph rendered');
    assert.equal(await well.evaluate(el=>getComputedStyle(el).backgroundColor),thumbBg);
    near((await card.boundingBox()).height,83,'Collection height preserved');
   }
   report.geometry.push({theme,width,tileWidth:boxes[0].width,tileHeight:boxes[0].height});
  }
  await page.setViewportSize({width:390,height:844});await page.getByText('Shall we wander?',{exact:true}).scrollIntoViewIfNeeded();await shot('home',theme);await shot('around-you',theme,page.getByTestId('around-you-grid'));
  await page.locator('[role="button"][data-testid^="home-collection-"]').first().scrollIntoViewIfNeeded();await page.waitForTimeout(450);await shot('home-collections',theme);
  for(const category of ['eat','bars','routes','events']){await page.getByTestId('home-count-tile-'+category).click();await page.waitForURL(url=>url.pathname==='/home/browse'&&url.searchParams.get('category')===category);await page.getByTestId('home-field-guide').last().waitFor();await page.goBack();await page.getByTestId('around-you-grid').waitFor();}

  await page.goto('http://127.0.0.1:9876/home/collections',{waitUntil:'domcontentloaded'});
  const collectionList=page.locator('[role="button"][data-testid^="home-collection-list-"]');await collectionList.first().waitFor({timeout:60000});
  await page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.zIndex==='20'&&s.position==='absolute'&&r.width>100&&r.height>100&&s.display!=='none';}),null,{timeout:30000});
  for(const card of await collectionList.all()){
   assert.equal(await card.locator('img').count(),0,'See all uses glyph thumbnails');
   assert.equal(await card.locator('svg').count(),2,'Leading glyph and chevron remain');
   near((await card.boundingBox()).height,83,'See all collection height preserved');
  }
  await shot('collection-list',theme);await collectionList.first().click();await page.waitForURL(/\/home\/collection\?id=/);await page.getByTestId('home-field-guide').last().waitFor();
  await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('RESTORED_TILE_REPORT '+JSON.stringify(report));
}
main().catch(async err=>{report.failure=err.stack;if(page&&!page.isClosed()){try{await shot('failure','unknown');console.log('RESTORED_TILE_DOM '+(await page.locator('body').innerText()).slice(0,5000));}catch{}}console.error(err);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();});
