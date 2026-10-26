import { EVENTS, RESTAURANTS } from '@/lib/data';
import { restaurantJournalMenu, type JournalMenuItem } from '@/lib/detail-journal';
import type { HomeIdea } from '@/lib/home-discovery';
import { entriesForHomeIdea, type HomeGuideCatalog, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';

/** One native geometry shared by all four categories. Never content-dependent. */
export const HOME_RESULT = { height:72, thumbnailWidth:72, thumbnailHeight:56, inset:8, gap:10, textGap:12, radius:13 } as const;
export const shortHomeTitle=(name:string)=>{const words=name.trim().split(/\s+/);return words.length>5?words.slice(0,5).join(' ')+'…':name;};

export function homeEntryCategory(entry:HomeGuideEntry):HomeGuideCategory {
  if(entry.kind==='event'||entry.kind==='venue'||['theatre','cinema','arts_centre','events_venue','music_venue','museum','gallery'].includes(entry.category||''))return 'events';
  if(entry.kind==='crawl'||entry.kind==='outdoor'||['park','nature_reserve','garden','trailhead','viewpoint'].includes(entry.category||''))return 'routes';
  if(entry.kind==='night'||['bar','pub','wine_bar','brewery','night_club'].includes(entry.category||''))return 'bars';
  return 'eat';
}

export function homeMenuItems(entry:HomeGuideEntry):readonly JournalMenuItem[] {
  if(entry.detailContent?.menu?.items.length)return entry.detailContent.menu.items;
  const restaurant=entry.kind==='restaurant'?RESTAURANTS[entry.id]:undefined;
  return restaurant?restaurantJournalMenu(restaurant).items:[];
}

export function homeEntryMetadata(entry:HomeGuideEntry):{primary:string;secondary?:string;glyph:string} {
  const category=homeEntryCategory(entry),offer=entry.detailContent?.offers?.[0];
  if(offer){
    const minimum=offer.description.match(/\bmin(?:imum)?(?:\s+order)?(?:\s+of)?\s*(\d+)/i)?.[1];
    const price=offer.description.match(/\$\d+(?:\.\d{2})?\s+[^·.]+/)?.[0]?.trim();
    return {primary:offer.label,secondary:price?[price,minimum?'min '+minimum:undefined].filter(Boolean).join(' · '):offer.title,glyph:'clock'};
  }
  if(category==='events')return entry.kind==='event'?{primary:entry.facts.filter(fact=>['calendar','clock'].includes(fact.glyph)).map(fact=>fact.value).join(' · ')||entry.caption,secondary:entry.caption,glyph:'calendar'}:{primary:entry.caption,secondary:entry.facts.find(fact=>fact.glyph==='pin')?.value,glyph:'landmark'};
  if(category==='routes')return {primary:entry.facts.filter(fact=>['route','walk','car'].includes(fact.glyph)).map(fact=>fact.value).join(' · ')||entry.caption,secondary:entry.facts.find(fact=>fact.glyph==='pin')?.value,glyph:entry.facts.some(fact=>fact.glyph==='car')?'car':'walk'};
  const distance=entry.facts.find(fact=>fact.glyph==='pin'&&/\bmi(?:les?)?\b/.test(fact.value));
  const priceFact=entry.facts.find(fact=>fact.glyph==='wallet');
  return {primary:entry.caption||'Explore the venue',secondary:[priceFact?.value,distance?.value].filter(Boolean).join(' · ')||undefined,glyph:category==='bars'?'drink':entry.glyph};
}

export type HomeChapter={id:string;title:string;entries:HomeGuideEntry[]};
const chapterTitles:Record<HomeGuideCategory,string>={eat:'A good table',bars:'One more stop',events:'A room with a stage',routes:'A little wandering'};

/** A collection keeps every current member, once, grouped into readable chapters. */
export function collectionChapters(entries:readonly HomeGuideEntry[]):HomeChapter[] {
  return (['eat','events','bars','routes'] as const).flatMap(category=>{
    const members=entries.filter(entry=>homeEntryCategory(entry)===category);
    const title=category==='events'&&members.every(entry=>entry.kind!=='event'&&['museum','gallery'].includes(entry.category||''))?'A little culture':chapterTitles[category];
    return members.length?[{id:category,title,entries:members}]:[];
  });
}

export function ideaChapters(idea:HomeIdea,catalog:HomeGuideCatalog,now=new Date()):HomeChapter[] {
  // Feature the actual menu/venue photographs already in the local pool.
  // Sparse listings remain in See all, without borrowing another place's image.
  const photoScore=(entry:HomeGuideEntry)=>homeMenuItems(entry).some(item=>item.image)?3:entry.detailContent?.photos?.length?2:entry.image?1:0;
  const entries=[...entriesForHomeIdea(idea,catalog)].sort((a,b)=>photoScore(b)-photoScore(a));if(!entries.length)return [];
  const category=homeEntryCategory(entries[0]),food=category==='eat';
  const firstTitle=food?(idea.query==='coffee'?'A little pause':idea.query==='breakfast'?'Start the day':'Something to start'):chapterTitles[category];
  const moreTitle=food?(idea.query==='coffee'?'More good coffee':idea.query==='breakfast'?'More good mornings':'Make it a meal'):category==='events'?'More on stage':category==='routes'?'Keep wandering':'More after dark';
  const result:HomeChapter[]=[{id:'start',title:firstTitle,entries:entries.slice(0,1)}];
  if(entries.length>1)result.push({id:'more',title:moreTitle,entries:entries.slice(1)});
  // Optional related choices remain real local records; there is no inferred
  // showtime, opening status or forced itinerary attached to a dinner idea.
  if(food&&!idea.query){
    const horizon=now.getTime()+7*86400000;
    const shows=catalog.categories.events.filter(entry=>entry.kind==='event'&&Boolean(EVENTS[entry.id]?.startsAt)&&Date.parse(EVENTS[entry.id].startsAt!)>=now.getTime()&&Date.parse(EVENTS[entry.id].startsAt!)<=horizon);
    const after=shows.length?shows:catalog.categories.bars;
    if(after.length)result.push({id:'after',title:'Keep the evening open',entries:after});
  }
  return result;
}
