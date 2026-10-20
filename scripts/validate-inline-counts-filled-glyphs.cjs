/* Branch-only browser checks for shorter tiles, aligned mobile rails and open, concise Vee shapes. */
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

async function checkFilled(page,label){
  const glyphs=page.locator('[data-testid^="filled-glyph-"]').filter({visible:true});
  const items=await glyphs.evaluateAll(nodes=>nodes.map(n=>{
    const s=getComputedStyle(n),b=n.getBBox();
    return {id:n.getAttribute('data-testid'),fill:s.fill,stroke:s.strokeWidth,paths:n.querySelectorAll('path').length,width:b.width,height:b.height};
  }));
  assert.ok(items.length>4,label+' shared glyphs rendered');
  for(const item of items){
    assert.ok(item.fill!=='none'&&item.fill!=='rgba(0, 0, 0, 0)',item.id+' has solid theme fill');
    assert.equal(Number.parseFloat(item.stroke),0,item.id+' has no outline');
    assert.ok(item.paths>0&&item.width>0&&item.height>0,item.id+' non-empty geometry');
  }
  report.checks.push(label+': '+items.length+' official filled glyphs rendered without outlines');
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
    const expectedGridWidth=Math.min(width,720)-(width<=400?30:34)*2;
    const expectedCardWidth=(expectedGridWidth-16)/2;
    const expectedWidth=expectedCardWidth-16;
    const grid=await dimensions(page.getByTestId('around-you-grid'));
    near(grid.width,expectedGridWidth,'Home grid fills content width',.5);
    near(grid.x,(width-Math.min(width,720))/2+(width<=400?30:34),'Home grid aligns with content gutter',.5);
    const tiles=[];
    for(const key of ['eat','bars','routes','events']){
      const frame=await dimensions(page.getByTestId('home-tile-window-'+key));
      near(frame.height,frame.width*73/121,theme+' '+width+' '+key+' reference photo ratio');
      near(frame.width,expectedWidth,theme+' '+width+' '+key+' reference photo width');
      const tile=await page.getByTestId('home-tile-window-'+key).evaluate(el=>{
        const button=el.closest('[role="button"]');
        const s=getComputedStyle(button);
        const outline=button.firstElementChild;
        const title=button.querySelector('[data-testid^="home-tile-title-"]');
        const heading=title.parentElement;
        const count=heading.querySelector('[data-testid^="home-tile-count-"]');
        const bodyChildren=heading.parentElement.children.length;
        const br=button.getBoundingClientRect();
        const metric=node=>{const r=node.getBoundingClientRect(),c=getComputedStyle(node);return {x:r.x-br.x,y:r.y-br.y,width:r.width,height:r.height,font:c.fontFamily,size:c.fontSize,line:c.lineHeight}};
        return {bg:s.backgroundColor,border:s.borderColor,borderWidth:s.borderWidth,shadow:s.boxShadow,
          width:br.width,height:br.height,radius:s.borderRadius,outline:getComputedStyle(outline).borderWidth,
          title:metric(title),heading:metric(heading),count:metric(count),bodyChildren,label:button.getAttribute('aria-label')};
      });
      assert.equal(tile.bg,theme==='light'?'rgb(245, 240, 233)':'rgb(41, 37, 42)','tile matches Collections');
      assert.equal(tile.borderWidth,'0px');
      assert.equal(tile.outline,'1px');
      assert.equal(tile.radius,'12px');
      near(tile.width,expectedCardWidth,'Home card fills half the row',.5);
      assert.equal(tile.title.size,'17px');
      assert.equal(tile.bodyChildren,1,'Home tile contains only the heading row');
      near(tile.height,16+frame.height+11+tile.heading.height,'tile has no footer space',.8);
      assert.ok(tile.heading.height<24,'single compact heading line');
      assert.ok(Math.abs(tile.title.y-tile.count.y)<5,'count shares title baseline');
      assert.ok(tile.shadow!=='none','tile raised');
      const count=await dimensions(page.getByTestId('home-tile-count-'+key));
      const value=await page.getByTestId('home-tile-count-'+key).innerText();
      assert.match(value,/^\d+$/,'real inventory count is shown');
      assert.ok(count.x>=grid.x+(key==='bars'||key==='events'?expectedCardWidth+16:0)+8+tile.title.width+8-1,key+' title/count do not overlap');
      near(count.x+count.width,grid.x+(key==='bars'||key==='events'?expectedCardWidth+16:0)+expectedCardWidth-8,key+' count right aligned',.8);
      assert.equal(await page.getByTestId('home-tile-metadata-'+key).count(),0,'secondary metadata removed');
      assert.equal(await page.getByTestId('note-facts-home-count-tile-'+key).count(),0,'footer removed');
      tiles.push({key,...frame,tile,count:{...count,value}});
    
    }
    await checkOverflow(page,'Home '+theme+' '+width);
    report.geometry.push({screen:'Home',theme,width,tiles});
  }
  await page.setViewportSize({width:390,height:844});
  const ribbon=await dimensions(page.getByTestId('home-evening-ribbon'));
  assert.equal(ribbon.bg,theme==='light'?'rgb(245, 240, 233)':'rgb(41, 37, 42)');
  assert.equal(await page.getByTestId('home-tile-count-bars').innerText(),'10');
  assert.equal(await page.getByTestId('home-tile-count-routes').innerText(),'3');
  await checkGradients(page,'Home '+theme);
  await checkFilled(page,'Home '+theme);
  const navigation=await dimensions(page.getByTestId('editorial-navigation').filter({visible:true}).last());
  assert.equal(navigation.borderWidth,'1px');
  assert.ok(navigation.shadow.includes('24.2px'),'navigation elevation +10%');
  report.geometry.push({screen:'Navigation',theme,...navigation});
  await screenshot(page,'home',theme,true);
  for(const name of ['Discover','You']){
    await tab(page,name);
    await page.waitForTimeout(500);
    await checkOverflow(page,name+' '+theme);
    await checkGradients(page,name+' '+theme);
    await checkFilled(page,name+' '+theme);

    if(name==='Discover'){
      const reference=page.locator('[data-testid^="trail-show-"]').first();
      await reference.waitFor();
      await reference.scrollIntoViewIfNeeded();
      const card=await reference.evaluate(button=>{
        const title=button.querySelector('[data-testid="discover-listing-title"]');
        const caption=title.nextElementSibling,facts=caption.nextElementSibling;
        const br=button.getBoundingClientRect(),style=getComputedStyle(button);
        const metric=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:r.x-br.x,y:r.y-br.y,width:r.width,height:r.height,font:s.fontFamily,size:s.fontSize,line:s.lineHeight};};
        return {width:br.width,height:br.height,radius:style.borderRadius,title:metric(title),caption:metric(caption),facts:metric(facts)};
      });
      const home=report.geometry.find(row=>row.screen==='Home'&&row.theme===theme&&row.width===390);
      for(const tile of home.tiles){
        assert.equal(tile.tile.radius,card.radius,'shared card radius');
        near(tile.tile.title.x,card.title.x,'shared card inset',.5);
        for(const part of ['title']){
          near(tile.tile[part].height,card[part].height,tile.key+' '+part+' height',.6);
          assert.equal(tile.tile[part].size,card[part].size,tile.key+' '+part+' font size');
          assert.equal(tile.tile[part].font,card[part].font,tile.key+' '+part+' font family');
          assert.equal(tile.tile[part].line,card[part].line,tile.key+' '+part+' line height');
        }
      }
      for(const width of [320,390,430,736]){
        await page.setViewportSize({width,height:844});
        await page.waitForTimeout(200);
        const hero=await dimensions(page.getByTestId('trail-lead'));
        for(const slug of ['more-on-stage','more-good-tables','after-dinner','rooms-worth-knowing']){
          const section=page.getByTestId('trail-section-'+slug);
          const row=section.getByTestId('discover-photo-row');
          await row.evaluate(el=>{el.scrollLeft=0;});
          const cards=row.getByRole('button');
          const first=await dimensions(cards.nth(0)),second=await dimensions(cards.nth(1));
          near(first.x,hero.x,slug+' begins at hero edge',.8);
          if(width<=600){
            near(first.width,(hero.width-16)/2,slug+' mobile half row',.8);
            near(second.x+second.width,hero.x+hero.width,slug+' ends at hero edge',.8);
          }else near(first.width,137,slug+' retains wide-screen size',.8);
          near(second.x-first.x-first.width,16,slug+' shared gap',.8);
          const picture=await cards.first().evaluate(el=>{
            const photo=el.children[1],r=photo.getBoundingClientRect();
            return {width:r.width,height:r.height};
          });
          near(picture.width,first.width-16,slug+' photo fills inner card',.8);
          near(picture.height,73,slug+' photo height stays compact',.5);
          const scroll=await row.evaluate(el=>{
            const style=getComputedStyle(el);
            el.scrollLeft=el.scrollWidth;
            el.dispatchEvent(new Event('scroll',{bubbles:true}));
            return {offset:el.scrollLeft,width:el.clientWidth,content:el.scrollWidth,mask:style.maskImage};
          });
          assert.equal(scroll.mask,'none',slug+' closing card edge stays visible');
          if(await cards.count()>2&&width<=600){
            assert.ok(scroll.offset>0,slug+' extra cards still swipe');
            const last=await dimensions(cards.last());
            near(last.x+last.width,hero.x+hero.width,slug+' final card can meet right edge',1.2);
          }
          report.geometry.push({screen:'Discover rail',theme,viewport:width,section:slug,hero,first,second,picture,scroll});
          await row.evaluate(el=>{el.scrollLeft=0;el.dispatchEvent(new Event('scroll',{bubbles:true}));});
        }
        await checkOverflow(page,'Discover '+theme+' '+width);
      }
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(200);
      await reference.scrollIntoViewIfNeeded();
      report.checks.push(theme+': all four mobile photo rows align with the hero at 320, 390 and 430px, retain compact photos and allow scrolling');
      const cards=page.locator('[data-testid="trail-lead"],[data-testid^="trail-show-"],[data-testid^="trail-table-"],[data-testid^="trail-bar-"],[data-testid^="field-route-"],[data-testid^="field-room-"]');
      const fills=await cards.evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-testid'),bg:getComputedStyle(n).backgroundColor})));
      assert.ok(fills.length>10,'Discover containers audited across sections');
      for(const fill of fills)assert.equal(fill.bg,theme==='dark'?ribbon.bg:'rgb(247, 242, 236)',fill.id+' correct default card fill');
      report.checks.push(theme+': '+fills.length+' Discover containers use the shared default card background');
      report.geometry.push({screen:'More on stage reference',theme,...card});
      report.checks.push(theme+': all Home tiles use a single title/count row without footer metadata');
    }
    await screenshot(page,name==='You'?'profile':'discover',theme,name==='Discover');
  }
  await tab(page,'Vee');
  await page.getByText('Where to?',{exact:true}).waitFor();
  await page.waitForTimeout(600);
  const composer=page.getByTestId('vee-composer-box');
  const box=await dimensions(composer);
  const input=page.getByTestId('vee-text-input');
  assert.equal(await input.getAttribute('placeholder'),'Describe your ideal night');
  assert.equal(await input.getAttribute('aria-label'),'Describe your ideal night');
  const field=await dimensions(input);
  near(field.height,105.6,'Vee input +20%',.5);
  assert.equal(field.borderWidth,'0px');
  assert.equal(box.borderWidth,'1px');
  for(const key of ['details','mic','send']){
    const control=await dimensions(page.getByTestId('vee-composer-'+key));
    assert.ok(control.x>=box.x&&control.x+control.width<=box.x+box.width+1,key+' inside horizontally');
    assert.ok(control.y>=box.y&&control.y+control.height<=box.y+box.height+1,key+' inside vertically');
    const floorClearance=box.y+box.height-(control.y+control.height);
    assert.ok(floorClearance>=12,key+' has at least 12px bottom breathing room: '+floorClearance);
    report.geometry.push({screen:'Vee '+key,theme,...control,floorClearance});
  }
  assert.equal(await page.getByTestId('vee-open-letter').getByText('Vee',{exact:true}).count(),0,'no redundant Vee text in hero');
  await checkOverflow(page,'Vee '+theme);
  await checkGradients(page,'Vee '+theme);
  await checkFilled(page,'Vee '+theme);
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
  assert.equal(await page.getByTestId('vee-shapes-toggle').getAttribute('aria-expanded'),'true','shapes open by default');
  await page.getByTestId('vee-shape-card').first().waitFor();
  await page.getByTestId('vee-shapes-toggle').click();
  assert.equal(await page.getByTestId('vee-shapes-toggle').getAttribute('aria-expanded'),'false','shapes still collapse');
  assert.equal(await page.getByTestId('vee-shape-card').count(),0);
  await page.getByTestId('vee-shapes-toggle').click();
  assert.equal(await page.getByTestId('vee-shapes-toggle').getAttribute('aria-expanded'),'true');
  const shapes=page.getByTestId('vee-shape-card');
  await shapes.first().waitFor();
  const titles=await page.getByTestId('vee-shape-title').allTextContents();
  assert.ok(titles.length>0&&titles.length<=3,'actual available shape count');
  for(const title of titles){
    assert.ok(title.trim().length>0,'actual starting place named');
    assert.ok(!title.includes(' · '),'ingredient list replaced by actual anchor');
  }
  for(const shape of await shapes.all()){
    const title=shape.getByTestId('vee-shape-title');
    const facts=shape.getByTestId('vee-shape-facts');
    const text=await facts.innerText();
    assert.match(text,/\d+ stops?/,'actual stop count remains');
    assert.ok(!text.includes('→')&&!text.includes('$')&&!text.includes('walk'),'only essential facts visible');
    const direct=await shape.evaluate(el=>el.querySelector('[data-testid="vee-shape-title"]').parentElement.children.length);
    assert.equal(direct,2,'two lines per shape');
    const factCount=await facts.evaluate(el=>el.children.length);
    assert.ok(factCount>=1&&factCount<=2,'at most two glyph facts');
    const label=await shape.getAttribute('aria-label');
    assert.ok(label.includes('→'),'full route retained for accessibility');
    const geometry=await dimensions(shape);
    assert.ok(geometry.height<=74,'shape fits compact 72px row');
    report.geometry.push({screen:'Vee shape',theme,title:await title.innerText(),facts:text,...geometry});
  }
  report.checks.push(theme+': shapes open on entry, collapse normally and show two simple lines');
  for(const old of ['Low-key & walkable','Big night out','Late & loud'])assert.equal(await page.getByText(old,{exact:true}).count(),0,'old playful title absent');
  await page.getByRole('button',{name:'Other plan options',exact:true}).waitFor();
  await shapes.first().scrollIntoViewIfNeeded();
  await screenshot(page,'vee-shapes',theme,true);
  const firstStop=titles[0];
  await shapes.first().click();
  await page.waitForURL(/\/plan(?:[?#]|$)/,{timeout:15000});
  await page.getByText(firstStop,{exact:true}).filter({visible:true}).first().waitFor({timeout:15000});
  report.checks.push(theme+': plain shape selection opens the real plan with its chosen stops');
  await page.getByRole('button',{name:'Go back',exact:true}).filter({visible:true}).first().click();
  await page.getByTestId('vee-text-input').waitFor();
  if(await page.getByTestId('vee-shapes-toggle').getAttribute('aria-expanded')==='true')await page.getByTestId('vee-shapes-toggle').click();
  await input.fill('Fox Theater');
  await page.getByText('Ask Vee to plan around this',{exact:true}).waitFor();
  report.checks.push(theme+': live place search responds to typing');
  await input.fill('');
  await page.getByText('What should change?',{exact:true}).waitFor();
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

  await page.setViewportSize({width:390,height:1800});
  await page.goto('http://127.0.0.1:9876/glyph-audit',{waitUntil:'domcontentloaded'});
  await page.getByText('Existing icon calls',{exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('[data-testid^="glyph-case-"]').count(),53,'entire shared registry rendered');
  assert.equal(await page.locator('[data-testid^="legacy-glyph-case-"]').count(),25,'every legacy ID rendered');
  assert.equal(await page.locator('[data-testid^="legacy-glyph-case-"] svg[data-testid^="filled-glyph-"]').count(),50,'legacy paths resolve to real filled glyphs');
  await checkFilled(page,'Icon catalog '+theme);
  await checkOverflow(page,'Icon catalog '+theme);
  await screenshot(page,'glyphs',theme,true);
  await context.close();
 }
 assert.deepEqual(report.errors,[],'no browser runtime exceptions');
 report.checks.push('Both themes, inline inventory counts, filled icons, the new Vee prompt, mobile rows and real plan selection passed');
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
