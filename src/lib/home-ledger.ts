import { searchHomeGuide, type HomeGuideCatalog, type HomeGuideCategory, type HomeGuideEntry, type HomeGuideFact } from '@/lib/home-guide';

type LedgerFilter = { id: string; label: string; glyph: string };
type LedgerDefinition = {
  title: string; href: `/home/${HomeGuideCategory}`; singular: string; plural: string;
  search: string; filters: readonly LedgerFilter[];
};

/** Four destinations share their presentation, never their result pools. */
export const HOME_LEDGERS: Record<HomeGuideCategory, LedgerDefinition> = {
  eat: { title:'Eat', href:'/home/eat', singular:'place', plural:'places', search:'Search food', filters:[
    {id:'all',label:'All',glyph:'filter'}, {id:'tables',label:'Tables',glyph:'food'},
    {id:'quick',label:'Quick bites',glyph:'food'}, {id:'coffee',label:'Coffee',glyph:'coffee'},
  ] },
  bars: { title:'Bars', href:'/home/bars', singular:'bar', plural:'bars', search:'Search bars', filters:[
    {id:'all',label:'All',glyph:'filter'}, {id:'cocktails',label:'Cocktails',glyph:'drink'},
    {id:'beer',label:'Beer',glyph:'drink'}, {id:'listening',label:'Listening rooms',glyph:'music'},
  ] },
  routes: { title:'Routes', href:'/home/routes', singular:'route', plural:'routes', search:'Search routes', filters:[
    {id:'all',label:'All',glyph:'filter'}, {id:'walking',label:'Walking',glyph:'walk'}, {id:'rides',label:'Rides',glyph:'car'},
  ] },
  events: { title:'Events', href:'/home/events', singular:'listing', plural:'listings', search:'Search events', filters:[
    {id:'all',label:'All',glyph:'filter'}, {id:'music',label:'Music',glyph:'music'},
    {id:'outdoors',label:'Outdoors',glyph:'hike'}, {id:'movies',label:'Movies',glyph:'film'},
  ] },
};

export function isHomeLedgerCategory(value: unknown): value is HomeGuideCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HOME_LEDGERS, value);
}

function matchesFilter(entry: HomeGuideEntry, filter: string): boolean {
  const food=entry.foodTags || entry.searchText;
  if(filter==='tables')return entry.kind==='restaurant'||entry.category==='restaurant';
  if(filter==='quick')return /coffee|cafe|bakery|sandwich|burger|pizza|taco|deli/.test(food);
  if(filter==='coffee')return /\b(coffee|cafe|espresso)\b/.test(food);
  if(filter==='cocktails')return /cocktail|mezcal/.test(entry.searchText);
  if(filter==='beer')return /\b(beer|taproom|brewery|pub)\b/.test(entry.searchText);
  if(filter==='listening')return /hi-fi|listening|vinyl/.test(entry.searchText);
  if(filter==='walking')return !entry.facts.some(fact=>fact.glyph==='car');
  if(filter==='rides')return entry.facts.some(fact=>fact.glyph==='car');
  if(filter==='music')return entry.tags?.includes('Live music') ?? false;
  if(filter==='outdoors')return entry.tags?.includes('Outdoor') ?? false;
  if(filter==='movies')return entry.tags?.includes('Movies') ?? false;
  return true;
}

export function homeLedgerEntries(catalog: HomeGuideCatalog, category: HomeGuideCategory, query='', filter='all'): HomeGuideEntry[] {
  const entries=catalog.categories[category].filter(entry=>matchesFilter(entry,filter));
  // Match inside this inventory, preserving its nearest/source order. A global
  // name-deduplication pass could hide a bar behind a same-named restaurant.
  return query.trim()?searchHomeGuide(catalog,query,entries):entries;
}

export function homeLedgerFilters(entries: readonly HomeGuideEntry[], category: HomeGuideCategory, selected='all'): readonly LedgerFilter[] {
  return HOME_LEDGERS[category].filters.filter(filter=>filter.id==='all'||filter.id===selected||entries.some(entry=>matchesFilter(entry,filter.id)));
}

/** Display only supplied facts. Missing prices, distances and durations stay absent. */
export function homeLedgerSummary(entry: HomeGuideEntry, category: HomeGuideCategory): {
  caption: string; glyph: string; facts: HomeGuideFact[];
} {
  const factsByGlyph=(...glyphs:string[])=>glyphs.flatMap(glyph=>entry.facts.filter(fact=>fact.glyph===glyph));
  if(category==='routes')return {
    caption:entry.facts.some(fact=>fact.glyph==='car')?'Rides between stops':'Walking route',
    glyph:entry.facts.some(fact=>fact.glyph==='car')?'car':'walk', facts:factsByGlyph('route','walk','car').slice(0,2),
  };
  if(category==='events')return {caption:entry.caption,glyph:'landmark',facts:factsByGlyph('calendar','clock').slice(0,2)};
  if(category==='bars')return {caption:entry.caption,glyph:'drink',facts:factsByGlyph('clock').slice(0,1)};
  return {caption:entry.caption,glyph:entry.glyph,facts:factsByGlyph('wallet','pin').slice(0,2)};
}
