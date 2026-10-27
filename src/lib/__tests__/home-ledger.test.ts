import { BUNDLE_CITY } from '@/lib/city';
import { applyCurationForCity } from '@/lib/curation';
import { EVENTS, RESTAURANTS } from '@/lib/data';
import { buildHomeGuide } from '@/lib/home-guide';
import { HOME_LEDGERS, homeLedgerEntries, homeLedgerFilters, homeLedgerSummary, homeOpenLedgerContent, isHomeLedgerCategory } from '@/lib/home-ledger';
import type { NearestPick } from '@/lib/nearest-pool';

const now=new Date(2026,9,22,18);
const nearest:NearestPick[]=['mua','itani'].map((id,i)=>({
  id,name:RESTAURANTS[id].name,cuisine:RESTAURANTS[id].cuisine,price:RESTAURANTS[id].price,
  thumbnailGlyph:'food',href:`/restaurant/${id}`,miles:i+.4,estimated:i===1,distanceLabel:i?'~1.4 mi':'0.4 mi',
}));
const build=(overrides:Partial<Parameters<typeof buildHomeGuide>[0]>={})=>buildHomeGuide({
  city:'oakland',now,nearest,places:[],events:[],picks:[],...overrides,
});
afterEach(()=>applyCurationForCity(BUNDLE_CITY));

describe('Independent Home ledgers',()=>{
  it('keeps Open Ledger facts source-backed without substituting dish prices or street addresses',()=>{
    const source=build().categories.eat[0],distance={glyph:'pin',value:'~0.4 mi',label:'Estimated distance: ~0.4 mi'},price={glyph:'wallet',value:'$$'};
    expect(homeOpenLedgerContent({...source,caption:'Californian',facts:[price,distance]},'eat')).toEqual({caption:'Californian',facts:[price,distance]});
    expect(homeOpenLedgerContent({...source,facts:[{glyph:'pin',value:'123 Broadway'}]},'eat').facts).toEqual([]);
    expect(homeOpenLedgerContent({...source,facts:[]},'eat').facts).toEqual([]);
  });

  it('uses supplied show date and time without replacing the venue caption',()=>{
    const source=build().categories.eat[0],facts=[{glyph:'calendar',value:'Tonight',label:'October 27'},{glyph:'clock',value:'8 PM'},{glyph:'pin',value:'1807 Telegraph Ave'}];
    expect(homeOpenLedgerContent({...source,kind:'event',caption:'Fox Theater',facts},'events')).toEqual({caption:'Fox Theater',facts:facts.slice(0,2)});
  });

  it('avoids repeated route captions while preserving explicit stops and ride requirements',()=>{
    const source=build().categories.routes[0],facts=[{glyph:'route',value:'4 stops'},{glyph:'car',value:'Rides'}];
    expect(homeOpenLedgerContent({...source,caption:'4 stops · cross-town',facts},'routes')).toEqual({caption:'Rides between stops',facts});
  });

  it('retains listed bar hours without inventing an open-now status',()=>{
    const source=build().categories.bars[0],hours={glyph:'clock',value:'Fri–Sat until 2 AM'};
    expect(homeOpenLedgerContent({...source,facts:[hours]},'bars').facts).toEqual([hours]);
  });

  it('has four distinct destinations and rejects inherited object keys as categories',()=>{
    expect(Object.values(HOME_LEDGERS).map(item=>item.href)).toEqual(['/home/eat','/home/bars','/home/routes','/home/events']);
    for(const value of ['toString','constructor','all',undefined,null,[]])expect(isHomeLedgerCategory(value)).toBe(false);
  });

  it('keeps search inside the corresponding inventory, preserving the nearest order',()=>{
    const catalog=build();
    expect(homeLedgerEntries(catalog,'eat').map(entry=>entry.id)).toEqual(['mua','itani']);
    expect(homeLedgerEntries(catalog,'eat','Bar Shiru')).toEqual([]);
    expect(homeLedgerEntries(catalog,'bars','ramen')).toEqual([]);
    expect(homeLedgerEntries(catalog,'routes','ramen')).toEqual([]);
    expect(homeLedgerEntries(catalog,'events','MUA')).toEqual([]);
    expect(homeLedgerEntries(catalog,'eat','mua').map(entry=>entry.id)).toEqual(['mua']);
  });

  it('does not lose a bar when a restaurant has the same searchable name',()=>{
    const catalog=build(),bar=catalog.categories.bars.find(entry=>entry.id==='bar-shiru')!;
    catalog.entries={'restaurant:shared':{...catalog.categories.eat[0],id:'shared',name:bar.name,searchText:bar.searchText},...catalog.entries};
    expect(homeLedgerEntries(catalog,'bars','Bar Shiru').map(entry=>entry.kind+':'+entry.id)).toEqual(['night:bar-shiru']);
  });

  it('combines filters with query text rather than widening to a global result set',()=>{
    const catalog=build();
    expect(homeLedgerEntries(catalog,'bars','bar shiru','beer')).toEqual([]);
    expect(homeLedgerEntries(catalog,'bars','bar shiru','listening').map(entry=>entry.id)).toEqual(['bar-shiru']);
    expect(homeLedgerEntries(catalog,'routes','uptown','walking').map(entry=>entry.id)).toEqual(['uptown']);
    expect(homeLedgerEntries(catalog,'routes','uptown','rides')).toEqual([]);
    expect(homeLedgerEntries(catalog,'eat','mua','coffee')).toEqual([]);
  });

  it('uses event source categories rather than guessing a genre from a title',()=>{
    const event=Object.values(EVENTS).find(item=>item.startsAt)!;
    const catalog=build({now:new Date(Date.parse(event.startsAt!)-3600000),events:[
      {...event,id:'band',name:'American Football',cats:['Live music']},
      {...event,id:'movie',name:'The Sound of Music',cats:['Movies']},
      {...event,id:'outside',name:'Jazz in the Park',cats:['Outdoor']},
    ]});
    expect(homeLedgerEntries(catalog,'events','','music').map(entry=>entry.id)).toEqual(['band']);
    expect(homeLedgerEntries(catalog,'events','','movies').map(entry=>entry.id)).toEqual(['movie']);
    expect(homeLedgerEntries(catalog,'events','','outdoors').map(entry=>entry.id)).toEqual(['outside']);
  });

  it('keeps another city empty instead of substituting Oakland listings',()=>{
    const catalog=build({city:'san-francisco',nearest:[]});
    for(const category of ['eat','bars','routes','events'] as const){
      expect(homeLedgerEntries(catalog,category,'')).toEqual([]);
      expect(homeLedgerEntries(catalog,category,'Oakland')).toEqual([]);
      expect(homeLedgerFilters(catalog.categories[category],category).map(filter=>filter.id)).toEqual(['all']);
    }
  });

  it('preserves source distance estimates and never invents missing prices or durations',()=>{
    const catalog=build(),food=catalog.categories.eat[1],bar=catalog.categories.bars[0],route=catalog.categories.routes[0];
    const snapshot=JSON.stringify(catalog);
    const foodFacts=homeLedgerSummary(food,'eat').facts;
    expect(foodFacts.map(fact=>fact.value)).toEqual([food.facts[0].value,'~1.4 mi']);
    expect(foodFacts[1].label).toBe('Estimated distance: ~1.4 mi');
    expect(homeLedgerSummary(bar,'bars').facts).toEqual(bar.facts.filter(fact=>fact.glyph==='clock'));
    expect(homeLedgerSummary(route,'routes').facts.every(fact=>route.facts.includes(fact))).toBe(true);
    expect(homeLedgerSummary({...food,facts:[]},'eat').facts).toEqual([]);
    expect(JSON.stringify(catalog)).toBe(snapshot);
  });
});
