import { answerDetailQuestion, detailPlanHref, type DetailContext } from '@/lib/detail-assistant';
import { ledgerContext, ledgerEssentials, ledgerMetadata, ledgerSnapshot } from '@/lib/detail-ledger';
import type { HomeGuideEntry } from '@/lib/home-guide';

const entry:HomeGuideEntry={kind:'restaurant',id:'shootingstar',name:'Shooting Star Cafe',caption:'Hong Kong cafe',description:'A late dinner option.',glyph:'food',searchText:'',
  facts:[{glyph:'wallet',value:'$$'},{glyph:'pin',value:'~0.2 mi',label:'Estimated distance: ~0.2 mi'}],
  details:[{label:'Address',value:'1022 Webster St, Oakland'},{label:'Hours',value:'Daily 7:30 AM–midnight'},
    {label:'Late menu',value:'Dinner until 11:30 PM'},{label:'Service',value:'Dine-in · pickup · delivery'},{label:'Phone',value:'(510) 251-9882'}],
  sections:[{title:'Menu highlights',lines:['Wonton Noodle Soup · $12.95']}],
  links:[{label:'Menu',url:'https://example.com/menu'},{label:'Directions',url:'https://example.com/maps'},{label:'Official site',url:'https://example.com'}]};

describe('Ledger companion source facts',()=>{
  it('prioritizes address, listed hours and service without losing the other source details',()=>{
    expect(ledgerEssentials(entry).map(fact=>fact.label)).toEqual(['Address','Hours','Service']);
    expect(ledgerContext(entry).facts).toEqual(expect.arrayContaining([
      {label:'Late menu',value:'Dinner until 11:30 PM'},{label:'Phone',value:'(510) 251-9882'},
      {label:'Estimated distance',value:'~0.2 mi'},{label:'Menu highlights',value:'Wonton Noodle Soup · $12.95'},
    ]));
  });
  it('uses the approved snapshot only for the matching venue and address',()=>{
    expect(ledgerSnapshot(entry)).toBe('An all-day Hong Kong café with a late dinner menu.');
    expect(ledgerSnapshot({...entry,details:[{label:'Address',value:'A different address'}]})).toBe(entry.description);
  });
  it('keeps missing prices absent and does not label a street as distance',()=>{
    const night={...entry,kind:'night' as const,facts:[{glyph:'pin',value:'1535 Broadway'},{glyph:'clock',value:'Hours on the official page'}]};
    expect(ledgerMetadata(night)).toEqual([{glyph:'clock',value:'Hours on the official page'}]);
    expect(ledgerContext(night).facts).toContainEqual({label:'Location',value:'1535 Broadway'});
    expect(ledgerMetadata({...entry,facts:[]})).toEqual([]);
  });
});

describe('Contextual detail assistant',()=>{
  const context=ledgerContext(entry);
  it('answers pronoun questions from the currently open listing and preserves listed hours',()=>{
    const answer=answerDetailQuestion(context,'Is it open late for dinner?');
    expect(answer.text).toContain('Daily 7:30 AM–midnight');
    expect(answer.text).toContain('Dinner until 11:30 PM');
    expect(answer.text).toContain('listed times');
    expect(answer.text).not.toMatch(/yes|open now/i);
  });
  it('preserves estimated distance and price instead of inventing exact amounts',()=>{
    expect(answerDetailQuestion(context,'How far is it?').text).toContain('Estimated distance: ~0.2 mi');
    expect(answerDetailQuestion(context,'How much does it cost?').text).toBe('Price: $$');
  });
  it('prefers the detailed event date over a repeated relative date label',()=>{
    const event:DetailContext={kind:'event',id:'show',name:'A show',facts:[
      {label:'When',value:'October 23, 2026 at 8 PM'},{label:'Showtime',value:'8 PM'},
      {label:'When',value:'Tonight'},{label:'Time',value:'8 PM'},
    ],links:[]};
    const answer=answerDetailQuestion(event,'What time does it start?');
    expect(answer.text).toContain('When: October 23, 2026 at 8 PM');
    expect(answer.text).not.toContain('Tonight');
    expect(answer.text.match(/8 PM/g)).toHaveLength(2);
  });
  it('does not infer parking or allergen safety from the cuisine or menu',()=>{
    expect(answerDetailQuestion(context,'Is there parking?').text).toContain('not included');
    expect(answerDetailQuestion(context,'Is it safe to eat with a nut allergy?').text).toContain('does not confirm');
  });
  it('reads menu details and exposes only public source links',()=>{
    const answer=answerDetailQuestion({...context,links:[...context.links,{label:'Order',url:'javascript:alert(1)'}]},'What food is on the menu?');
    expect(answer.text).toContain('Wonton Noodle Soup · $12.95');
    expect(answer.links).toEqual([{label:'Menu',url:'https://example.com/menu'}]);
  });
  it('does not borrow facts from a different venue after the context changes',()=>{
    const other:DetailContext={kind:'venue',id:'new',name:'Another room',facts:[],links:[]};
    const answer=answerDetailQuestion(other,'What are its hours?');
    expect(answer.text).toContain('Another room');expect(answer.text).not.toContain('midnight');
  });
  it('carries the right pinned IDs to Vee and safely encodes a title',()=>{
    for(const [kind,key] of Object.entries({restaurant:'restaurantId',night:'nightlifeId',event:'eventId',venue:'venueId',crawl:'crawlId'})){
      const href=detailPlanHref({...context,kind,name:'A & B? #1',id:'some/id'}),params=new URLSearchParams(href.split('?')[1]);
      expect(params.get(key)).toBe('some/id');expect(params.get('q')).toBe('Plan an evening around A & B? #1');
    }
    expect([...new URLSearchParams(detailPlanHref({...context,kind:'constructor'}).split('?')[1]).keys()]).toEqual(['q']);
  });
});
