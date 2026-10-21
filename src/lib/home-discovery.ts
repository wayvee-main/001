import { currentDaypart, type Daypart } from '@/lib/daypart';
import { CURATED_COLLECTION_ORDER, CURATED_COLLECTIONS, EVENTS, activeCollectionItems, type CuratedCollection } from '@/lib/data';

export type HomeIdeaTopic = 'food' | 'outdoors' | 'events' | 'bars' | 'late-food' | 'tomorrow';
export type HomeIdea = { id: string; title: string; detail: string; glyph: string; topic: HomeIdeaTopic; query?: string; href: string };
type IdeaSeed = Omit<HomeIdea, 'href'>;

const IDEAS: Record<Daypart, readonly IdeaSeed[]> = {
  morning: [
    {id:'breakfast',title:'Breakfast, then out',detail:'Coffee · breakfast · bakeries',glyph:'coffee',topic:'food',query:'breakfast'},
    {id:'fresh-air',title:'A little fresh air',detail:'Trails · parks · hiking',glyph:'walk',topic:'outdoors'},
    {id:'on-stage',title:'Something on stage',detail:'Shows · live music',glyph:'ticket',topic:'events'},
  ],
  midday: [
    {id:'lunch',title:'Make time for lunch',detail:'Quick bites · a good table',glyph:'food',topic:'food',query:'lunch'},
    {id:'scenic',title:'Take the scenic way',detail:'Trails · parks · hiking',glyph:'walk',topic:'outdoors'},
    {id:'on-stage',title:'Something on stage',detail:'Shows · live music',glyph:'ticket',topic:'events'},
  ],
  afternoon: [
    {id:'coffee',title:'One more good coffee',detail:'Cafés · a little pause',glyph:'coffee',topic:'food',query:'coffee'},
    {id:'fresh-air',title:'Get outside for a while',detail:'Trails · parks · hiking',glyph:'walk',topic:'outdoors'},
    {id:'dinner',title:'Make a dinner plan',detail:'Good tables · something new',glyph:'food',topic:'food'},
  ],
  evening: [
    {id:'dinner',title:'Find a good dinner',detail:'Good tables · easy bites',glyph:'food',topic:'food'},
    {id:'on-stage',title:'Catch something live',detail:'Shows · live music',glyph:'ticket',topic:'events'},
    {id:'nightcap',title:'Make one more stop',detail:'Cocktails · listening rooms',glyph:'drink',topic:'bars'},
  ],
  lateNight: [
    {id:'late-bites',title:'A late bite',detail:'Late kitchens · a last snack',glyph:'food',topic:'late-food'},
    {id:'nightcap',title:'A quieter nightcap',detail:'Bars · somewhere to unwind',glyph:'drink',topic:'bars'},
    {id:'tomorrow',title:'Leave tomorrow open',detail:'Breakfast · a walk · tomorrow',glyph:'sun',topic:'tomorrow'},
  ],
};

const withHomeHref = (idea: IdeaSeed): HomeIdea => ({...idea, href:'/home/ideas?idea='+encodeURIComponent(idea.id)});

/** Intentions on Home; every secondary door remains in Home's own guide. */
export function homeDiscoveryIdeas(now = new Date()): readonly HomeIdea[] {
  return IDEAS[currentDaypart(now)].map(withHomeHref);
}

/** A bookmarked idea remains browsable after its promotion window ends. */
export function homeDiscoveryIdea(id: string, now = new Date()): HomeIdea | undefined {
  const idea = IDEAS[currentDaypart(now)].find(item => item.id === id)
    ?? Object.values(IDEAS).flat().find(item => item.id === id);
  return idea ? withHomeHref(idea) : undefined;
}

const COLLECTIONS_BY_TIME: Record<Daypart, readonly CuratedCollection['id'][]> = {
  morning: ['morning-plates', 'outdoor-tables'],
  midday: ['outdoor-tables', 'slice-order'],
  afternoon: ['outdoor-tables', 'before-the-show', 'slice-order', 'yoshis-week', 'omca-fridays'],
  evening: ['before-the-show', 'yoshis-week', 'omca-fridays', 'outdoor-tables', 'slice-order'],
  lateNight: ['late-night'],
};

export function timelyHomeCollection(collection: CuratedCollection, now = new Date()): CuratedCollection | undefined {
  const horizon = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const items = activeCollectionItems(collection, now).filter(item => item.type !== 'event'
    || Boolean(EVENTS[item.id]?.startsAt && Date.parse(EVENTS[item.id].startsAt!) <= horizon));
  if (!items.length) return undefined;
  const firstEvent = items.find(item => item.type === 'event');
  return {...collection, items, coverImage: firstEvent ? EVENTS[firstEvent.id].image : collection.coverImage};
}

/** Home-only timing. Existing Discover collections and detail pages are untouched. */
export function homeDiscoveryCollections(now = new Date(), pool: readonly CuratedCollection[] = CURATED_COLLECTION_ORDER.map(id => CURATED_COLLECTIONS[id])): CuratedCollection[] {
  return COLLECTIONS_BY_TIME[currentDaypart(now)].flatMap(id => {
    const collection = pool.find(item => item.id === id);
    const current = collection ? timelyHomeCollection(collection, now) : undefined;
    return current ? [current] : [];
  });
}
