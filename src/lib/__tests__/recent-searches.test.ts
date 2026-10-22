import { clearRecentSearches, loadRecentSearches, recordRecentSearch } from '@/lib/recent-searches';
import { getStoredItem, setStoredItem } from '@/lib/storage';

jest.mock('@/lib/storage',()=>({getStoredItem:jest.fn(),setStoredItem:jest.fn()}));
let stored:string|null=null;
beforeEach(()=>{
  stored=null;
  jest.mocked(getStoredItem).mockReset().mockImplementation(async()=>stored);
  jest.mocked(setStoredItem).mockReset().mockImplementation(async(_key,value)=>{stored=value;});
});

it('restores legacy result history and typed queries, omitting malformed records',async()=>{
  stored=JSON.stringify([
    {label:'MUA',href:'/restaurant/mua'},
    {label:'Coffee',href:'/search?q=Coffee',query:'Coffee',city:'oakland'},
    {label:'Bad',href:'https://example.com'},
    {label:'Bad query',href:'/search',query:123},
  ]);
  expect(await loadRecentSearches()).toHaveLength(2);
});

it('deduplicates typed queries regardless of case and preserves separate city histories',async()=>{
  await recordRecentSearch({label:'Coffee',query:'Coffee',href:'/search?q=Coffee',city:'oakland'});
  await recordRecentSearch({label:'coffee',query:'coffee',href:'/search?q=coffee',city:'oakland'});
  const next=await recordRecentSearch({label:'coffee',query:'coffee',href:'/search?q=coffee',city:'san-francisco'});
  expect(next).toHaveLength(2);
  expect(next.map(item=>item.city)).toEqual(['san-francisco','oakland']);
});

it('persists the clear action across another load',async()=>{
  await recordRecentSearch({label:'MUA',href:'/restaurant/mua',city:'oakland'});
  await clearRecentSearches();
  expect(await loadRecentSearches()).toEqual([]);
});

it('keeps rapid writes ordered and lets Clear win over in-flight history updates',async()=>{
  await Promise.all([
    recordRecentSearch({label:'Coffee',query:'coffee',href:'/search?q=coffee',city:'oakland'}),
    recordRecentSearch({label:'Dinner',query:'dinner',href:'/search?q=dinner',city:'oakland'}),
  ]);
  expect((await loadRecentSearches()).map(item=>item.query)).toEqual(['dinner','coffee']);
  await Promise.all([
    recordRecentSearch({label:'Jazz',query:'jazz',href:'/search?q=jazz',city:'oakland'}),
    clearRecentSearches(),
  ]);
  expect(await loadRecentSearches()).toEqual([]);
});
