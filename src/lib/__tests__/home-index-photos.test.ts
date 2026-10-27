import { homeIndexPhotos } from '@/lib/home-index-photos';
import type { HomeGuideCatalog, HomeGuideEntry } from '@/lib/home-guide';

const entry = (overrides: Partial<HomeGuideEntry> = {}): HomeGuideEntry => ({
  kind: 'place', id: 'test', name: 'Local venue', caption: '', description: '',
  glyph: 'food', facts: [], searchText: '', details: [], links: [], ...overrides,
});
const catalog = (...entries: HomeGuideEntry[]): HomeGuideCatalog => ({
  entries: Object.fromEntries(entries.map(item => [`${item.kind}:${item.id}`, item])),
  categories: { eat: [], bars: [], routes: [], events: [] }, collections: [],
});

describe('Required photos on the four Home indexes', () => {
  it('tries independent photos from the same record and deduplicates shared URLs', () => {
    const place = entry({ image: 'https://venue.example/room.jpg', detailContent: {
      version: 1, sourceUrl: 'https://venue.example', verifiedAt: '2026-10-27T00:00:00Z',
      photos: [{ url: 'https://venue.example/gallery.jpg' }, { url: 'https://venue.example/room.jpg' }],
      menu: { url: 'https://venue.example/menu', items: [{ name: 'Dish', categories: [], image: 'https://venue.example/dish.jpg' }] },
    } });
    expect(homeIndexPhotos(place, catalog(place)).map(photo => photo.source)).toEqual([
      'https://venue.example/room.jpg', 'https://venue.example/gallery.jpg', 'https://venue.example/dish.jpg',
    ]);
  });

  it('does not fill a missing photograph with stock, an unsafe URL or a different venue', () => {
    const other = entry({ id: 'other', image: 'https://other.example/photo.jpg' });
    for (const image of [undefined, 'http://venue.example/photo.jpg', 'https://images.unsplash.com/stock.jpg', 'javascript:alert(1)', 'https://venue.example/logo.png', 'https://venue.example/mark.svg']) {
      const place = entry({ image });
      expect(homeIndexPhotos(place, catalog(place, other))).toEqual([]);
    }
  });

  it('retains the exact venue’s bundled photograph for loading and offline use', () => {
    const mua = entry({ kind: 'restaurant', id: 'mua', name: 'MUA' });
    expect(homeIndexPhotos(mua, catalog(mua))).toEqual([
      expect.objectContaining({ source: require('../../../assets/images/home-windows/eat.jpg'), label: expect.stringContaining('MUA') }),
    ]);
  });

  it('uses route-stop photos only after both the stop name and street match', () => {
    const route = entry({ kind: 'crawl', id: 'oldoakland', name: 'Oakland institutions crawl' });
    const wrongBranch = entry({ id: 'wrong', name: 'The Alley', image: 'https://other.example/alley.jpg', details: [{ label: 'Address', value: '99 Other Street, Oakland' }] });
    const stop = entry({ id: 'right', name: 'The Alley', image: 'https://alley.example/photo.jpg', details: [{ label: 'Address', value: '3325 Grand Ave, Oakland, CA' }] });
    expect(homeIndexPhotos(route, catalog(route, wrongBranch))).toEqual([]);
    expect(homeIndexPhotos(route, catalog(route, wrongBranch, stop))).toEqual([
      { source: 'https://alley.example/photo.jpg', label: 'The Alley, a stop on Oakland institutions crawl' },
    ]);
  });
});
