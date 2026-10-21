import { currentDaypart, type Daypart } from '@/lib/daypart';
import { CURATED_COLLECTION_ORDER, CURATED_COLLECTIONS, EVENTS, activeCollectionItems, type CuratedCollection } from '@/lib/data';

export type HomeIdea = {
  id: string;
  title: string;
  detail: string;
  glyph: string;
  href: string;
};

/** Browsing intentions, never a venue selected implicitly from the nearest pool.
 * The two venue chips beside Link your stay remain real local places. */
const IDEAS: Record<Daypart, readonly HomeIdea[]> = {
  morning: [
    {id:'breakfast',title:'Breakfast, then out',detail:'Coffee · breakfast · bakeries',glyph:'coffee',href:'/featured?q=breakfast'},
    {id:'fresh-air',title:'A little fresh air',detail:'Trails · parks · hiking',glyph:'walk',href:'/discover?q=hiking'},
    {id:'on-stage',title:'Something on stage',detail:'Shows · live music',glyph:'ticket',href:'/discover?mode=Events'},
  ],
  midday: [
    {id:'lunch',title:'Make time for lunch',detail:'Quick bites · a good table',glyph:'food',href:'/featured?q=lunch'},
    {id:'scenic',title:'Take the scenic way',detail:'Trails · parks · hiking',glyph:'walk',href:'/discover?q=hiking'},
    {id:'on-stage',title:'Something on stage',detail:'Shows · live music',glyph:'ticket',href:'/discover?mode=Events'},
  ],
  afternoon: [
    {id:'coffee',title:'One more good coffee',detail:'Cafés · a little pause',glyph:'coffee',href:'/featured?q=coffee'},
    {id:'fresh-air',title:'Get outside for a while',detail:'Trails · parks · hiking',glyph:'walk',href:'/discover?q=hiking'},
    {id:'dinner',title:'Make a dinner plan',detail:'Good tables · something new',glyph:'food',href:'/featured?q=dinner'},
  ],
  evening: [
    {id:'dinner',title:'Find a good dinner',detail:'Good tables · easy bites',glyph:'food',href:'/featured?q=dinner'},
    {id:'on-stage',title:'Catch something live',detail:'Shows · live music',glyph:'ticket',href:'/discover?mode=Events'},
    {id:'nightcap',title:'Make one more stop',detail:'Cocktails · listening rooms',glyph:'drink',href:'/discover?mode=Nightlife'},
  ],
  lateNight: [
    {id:'late-bites',title:'A late bite',detail:'Late kitchens · a last snack',glyph:'food',href:'/collection/late-night'},
    {id:'nightcap',title:'A quieter nightcap',detail:'Bars · somewhere to unwind',glyph:'drink',href:'/discover?mode=Nightlife'},
    {id:'tomorrow',title:'Leave tomorrow open',detail:'Breakfast · a walk · tomorrow',glyph:'sun',href:'/create?q=Plan%20tomorrow%20with%20breakfast%20and%20an%20easy%20hike'},
  ],
};

export function homeDiscoveryIdeas(now = new Date()): readonly HomeIdea[] {
  return IDEAS[currentDaypart(now)];
}

const COLLECTIONS_BY_TIME: Record<Daypart, readonly CuratedCollection['id'][]> = {
  morning: ['morning-plates', 'outdoor-tables'],
  midday: ['outdoor-tables', 'slice-order'],
  afternoon: ['outdoor-tables', 'before-the-show', 'slice-order', 'yoshis-week', 'omca-fridays'],
  evening: ['before-the-show', 'yoshis-week', 'omca-fridays', 'outdoor-tables', 'slice-order'],
  lateNight: ['late-night'],
};

/** Hour-sensitive shortlists shared by Home and See all. Dated collections
 * show only current entries in the next seven days and use an active cover.
 * This is editorial timing, never an assertion that a kitchen is open now. */
export function homeDiscoveryCollections(
  now = new Date(),
  pool: readonly CuratedCollection[] = CURATED_COLLECTION_ORDER.map(id => CURATED_COLLECTIONS[id]),
): CuratedCollection[] {
  const horizon = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  return COLLECTIONS_BY_TIME[currentDaypart(now)].flatMap(id => {
    const collection = pool.find(item => item.id === id);
    if (!collection) return [];
    const items = activeCollectionItems(collection, now).filter(item => item.type !== 'event'
      || Boolean(EVENTS[item.id]?.startsAt && Date.parse(EVENTS[item.id].startsAt!) <= horizon));
    if (!items.length) return [];
    const firstEvent = items.find(item => item.type === 'event');
    return [{...collection, items, coverImage: firstEvent ? EVENTS[firstEvent.id].image : collection.coverImage}];
  });
}
