import { RESTAURANTS, EVENTS } from '@/lib/data';
import { compactJournalFacts, eventJournalDetails, eventJournalFacts, filterJournalMenu, journalMenuCategories, restaurantJournalMenu } from '@/lib/detail-journal';

describe('Journal source boundaries',()=>{
  it('keeps lunch prices attached to the approved menu and official ordering source',()=>{
    const menu=restaurantJournalMenu(RESTAURANTS.shootingstar);
    expect(menu.items).toHaveLength(4);
    expect(menu.items.every(item=>item.note?.includes('lunch-combo menu'))).toBe(true);
    expect(menu.note).toMatch(/availability/);
    expect(menu.specials[0].url).toBe(RESTAURANTS.shootingstar.orderUrl);
    expect(restaurantJournalMenu({...RESTAURANTS.shootingstar,sourceUrl:'https://example.com'}).specials).toEqual([]);
  });
  it('filters every item, including those below the lead cards, without losing a shared-category dish',()=>{
    const items=RESTAURANTS.farmhouse.menuHighlights;
    expect(journalMenuCategories(items)).toEqual(['All','Mains','Starters','Value','Drinks']);
    const value=filterJournalMenu(items,'Value');
    expect(value).toContain(items.find(item=>item.name==='Tom Yum'));
    expect(value).toContain(items.find(item=>item.name==='Mango Sticky Rice'));
    expect(filterJournalMenu(items,'All')).toBe(items);
    expect(filterJournalMenu(items,'Unknown')).toEqual([]);
  });
  it('does not replace absent merchant photos with an unrelated editorial dish',()=>{
    const menu=restaurantJournalMenu(RESTAURANTS.farmhouse);
    expect(menu.items).toBe(RESTAURANTS.farmhouse.menuHighlights);
    expect(menu.items[0].image).toBeUndefined();
    expect(menu.specials).toEqual([]);
  });
  it('keeps shortened address labels separate from full facts without mutating them',()=>{
    const facts=[{label:'Address',value:'1022 Webster St, Oakland, CA 94607'},{label:'Hours',value:'Daily 7:30 AM–midnight'},{label:'Service',value:'Dine-in · pickup'}];
    const inline=compactJournalFacts(facts);
    expect(inline[0].value).toBe('1022 Webster St');
    expect(inline.map(fact=>fact.fullValue)).toEqual(facts.map(fact=>fact.value));
    expect(facts[0].value).toContain('94607');
    expect(compactJournalFacts([])).toEqual([]);
  });
  it('binds event enrichment to the official event URL rather than a name or venue',()=>{
    const event=EVENTS.bonobo,detail=eventJournalDetails(event);
    expect(detail.artists.map(artist=>artist.name)).toEqual(['Bonobo','Sofia Kourtesis']);
    expect(detail.upgrade?.description).toMatch(/Additional fee/);
    const other=eventJournalDetails({...event,sourceUrl:'https://thefoxoakland.com/events/a-different-show',lineup:'Another Artist',name:'Another Artist',vibeTags:[]});
    expect(other.upgrade).toBeUndefined();expect(other.ageLabel).toBeUndefined();expect(other.policies).toBeUndefined();
    expect(other.artists).toEqual([{name:'Another Artist',image:event.image,url:'https://thefoxoakland.com/events/a-different-show'}]);
    expect(other.artists[0].role).toBeUndefined();
  });
  it('omits unpublished doors and age rules instead of estimating from showtime',()=>{
    const event={...EVENTS.bonobo,date:'Fri Nov 20, 2026',sourceUrl:'https://example.com/show',vibeTags:[],lineup:'One · Two',name:'One'};
    expect(eventJournalFacts(event)).toEqual([
      {label:'When',value:'Fri Nov 20, 2026 · 8 PM',glyph:'calendar'},
      {label:'Venue',value:'Fox Theater',glyph:'pin'},
    ]);
    expect(eventJournalDetails(event).artists[1].image).toBeUndefined();
  });
});
