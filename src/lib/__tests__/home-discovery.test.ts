import { CURATED_COLLECTIONS, EVENTS, type CuratedCollection } from '@/lib/data';
import { homeDiscoveryCollections, homeDiscoveryIdeas } from '@/lib/home-discovery';

const at = (hour: number, minute = 0) => new Date(2026, 9, 21, hour, minute);
describe('Home discovery follows the hour', () => {
  it('offers intentions instead of fixed venues and changes at the daypart boundary', () => {
    expect(homeDiscoveryIdeas(at(8))[0].id).toBe('breakfast');
    expect(homeDiscoveryIdeas(at(11))[0].id).toBe('lunch');
    expect(homeDiscoveryIdeas(at(14))[0].id).toBe('coffee');
    expect(homeDiscoveryIdeas(at(17))[0].id).toBe('dinner');
    expect(homeDiscoveryIdeas(at(23))[0].id).toBe('late-bites');
    for (const hour of [2,8,12,15,19,23]) {
      const ideas=homeDiscoveryIdeas(at(hour));
      expect(ideas).toHaveLength(3);
      expect(new Set(ideas.map(x=>x.id)).size).toBe(3);
      expect(ideas.every(x=>!['/restaurant/','/place/','/night/','/event/'].some(prefix=>x.href.startsWith(prefix)))).toBe(true);
    }
  });
  it('suggests daylight activities in daytime and clearly labels tomorrow after dark', () => {
    expect(homeDiscoveryIdeas(at(9)).some(x=>x.href.includes('hiking'))).toBe(true);
    expect(homeDiscoveryIdeas(at(23)).some(x=>x.href.includes('/discover?q=hiking'))).toBe(false);
    expect(homeDiscoveryIdeas(at(1)).find(x=>x.id==='tomorrow')?.detail).toContain('tomorrow');
  });
  it('keeps breakfast and late kitchens in the right windows on Home and See all', () => {
    expect(homeDiscoveryCollections(at(8)).map(x=>x.id)).toEqual(['morning-plates','outdoor-tables']);
    expect(homeDiscoveryCollections(at(12)).map(x=>x.id)).toEqual(['outdoor-tables','slice-order']);
    expect(homeDiscoveryCollections(at(23)).map(x=>x.id)).toEqual(['late-night']);
    expect(homeDiscoveryCollections(at(19)).some(x=>x.id==='morning-plates'||x.id==='late-night')).toBe(false);
  });
  it('never falls back to an unrelated collection when a pool is empty', () => {
    expect(homeDiscoveryCollections(at(8),[])).toEqual([]);
    expect(homeDiscoveryCollections(at(23),[CURATED_COLLECTIONS['morning-plates']])).toEqual([]);
  });
  it('removes expired and distant event entries and takes the current artwork as cover', () => {
    const base=Object.values(EVENTS)[0];
    const keys=['home-preview-past','home-preview-week','home-preview-far'];
    try {
      EVENTS[keys[0]]={...base,id:keys[0],startsAt:'2026-10-20T20:00:00-07:00'};
      EVENTS[keys[1]]={...base,id:keys[1],startsAt:'2026-10-23T20:00:00-07:00',image:'https://venue.example/current-artist.jpg'};
      EVENTS[keys[2]]={...base,id:keys[2],startsAt:'2026-11-23T20:00:00-08:00'};
      const collection:CuratedCollection={...CURATED_COLLECTIONS['yoshis-week'],items:keys.map(id=>({type:'event' as const,id}))};
      const result=homeDiscoveryCollections(at(19),[collection]);
      expect(result).toHaveLength(1);
      expect(result[0].items.map(x=>x.id)).toEqual([keys[1]]);
      expect(result[0].coverImage).toBe(EVENTS[keys[1]].image);
    } finally { for(const key of keys) delete EVENTS[key]; }
  });
});
