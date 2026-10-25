import { collectionChapters, homeEntryMetadata, homeMenuItems, ideaChapters } from '@/lib/home-secondary';
import { buildHomeGuide, type HomeGuideEntry } from '@/lib/home-guide';
import { homeDiscoveryIdea } from '@/lib/home-discovery';

const place=(id:string,kind:HomeGuideEntry['kind']='place'):HomeGuideEntry=>({id,kind,name:id,caption:'Café',description:'',glyph:'coffee',facts:[],searchText:id,details:[],links:[]});

it('groups every current collection member once and keeps member order inside each chapter',()=>{
 const entries=[place('show','event'),place('table'),place('walk','outdoor'),place('bar','night'),place('another-table')];
 const chapters=collectionChapters(entries);
 expect(chapters.map(chapter=>chapter.id)).toEqual(['eat','events','bars','routes']);
 expect(chapters[0].entries.map(entry=>entry.id)).toEqual(['table','another-table']);
 expect(chapters.flatMap(chapter=>chapter.entries).map(entry=>entry.id).sort()).toEqual(entries.map(entry=>entry.id).sort());
});

it('keeps the menu and offer attached to their real source, including the minimum',()=>{
 const entry={...place('source'),detailContent:{version:1 as const,sourceUrl:'https://venue.example/menu',verifiedAt:'2026-10-25T12:00:00Z',
  menu:{url:'https://venue.example/menu',items:[{name:'Soup',price:'$12',categories:['Menu']}]},offers:[{title:'2 Buck Shuck',label:'Daily · 3–6 PM',description:'$2 oysters · minimum 6. From the official menu.',url:'https://venue.example/menu'}]}};
 expect(homeMenuItems(entry)[0].price).toBe('$12');
 expect(homeEntryMetadata(entry)).toEqual({primary:'Daily · 3–6 PM',secondary:'$2 oysters · min 6',glyph:'clock'});
 expect(homeMenuItems(place('another source'))).toEqual([]);
});

it('does not turn an address into a distance or invent prices and hours',()=>{
 const entry={...place('sparse'),facts:[{glyph:'pin',value:'12 Main Street'}]};
 expect(homeEntryMetadata(entry)).toEqual({primary:'Café',secondary:undefined,glyph:'coffee'});
 expect(homeEntryMetadata({...entry,facts:[{glyph:'pin',value:'0.3 mi'}]}).secondary).toBe('0.3 mi');
});

it('leaves an empty city empty instead of borrowing Oakland chapters or menus',()=>{
 const catalog=buildHomeGuide({city:'san-francisco',nearest:[],places:[],events:[],picks:[],now:new Date('2026-10-25T20:00:00Z')});
 const idea=homeDiscoveryIdea('dinner')!;
 expect(ideaChapters(idea,catalog)).toEqual([]);
});
