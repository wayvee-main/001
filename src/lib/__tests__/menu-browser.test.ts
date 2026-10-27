import { filterJournalMenu, journalMenuGroups, journalMenuSource, menuListingForPlace, restaurantJournalMenu } from '@/lib/detail-journal';
import type { DetailContent, DetailMenuItem } from '@/lib/detail-content';

const items:DetailMenuItem[]=[
  {name:'Café crème',desc:'Espresso and milk',price:'$5',categories:['Drinks','Breakfast']},
  {name:'Rice bowl',desc:'Roasted mushrooms and herbs',price:'$14',categories:['Mains','Vegetarian']},
  {name:'Side salad',price:'$7',categories:['Starters','Vegetarian']},
];

it('searches actual dish names, ingredients and categories with accent-insensitive matching',()=>{
  expect(filterJournalMenu(items,'All','cafe creme')).toEqual([items[0]]);
  expect(filterJournalMenu(items,'Vegetarian','mushrooms')).toEqual([items[1]]);
  expect(filterJournalMenu(items,'Breakfast','mushrooms')).toEqual([]);
  expect(filterJournalMenu(items,'All','not a published dish')).toEqual([]);
});

it('shows each dish once in source order even when it has multiple filter categories',()=>{
  const groups=journalMenuGroups(items);
  expect(groups.map(group=>group.title)).toEqual(['Drinks','Mains','Starters']);
  expect(groups.flatMap(group=>group.items)).toEqual(items);
});

it('keeps delivery prices tied to the named ordering source',()=>{
  const content:DetailContent={version:1,sourceUrl:'https://venue.example',verifiedAt:'2026-10-26T00:00:00Z',menu:{url:'https://www.doordash.com/store/venue-123',sourceKind:'doordash',pricingContext:'delivery',items}};
  expect(journalMenuSource(content,'https://venue.example/menu')).toEqual({label:'DoorDash',url:content.menu!.url,pricing:'Delivery prices · may differ at the venue'});
});

it('opens an original PDF without inventing structured dishes when extraction is incomplete',()=>{
  const content:DetailContent={version:1,sourceUrl:'https://venue.example',verifiedAt:'2026-10-26T00:00:00Z',menuDocuments:[{title:'Dinner',format:'pdf',url:'https://venue.example/dinner.pdf'}]};
  const listing=menuListingForPlace({id:'a-real-place',name:'A real place',detailContent:content},[],'san-francisco')!;
  expect(listing.menuUrl).toBe(content.menuDocuments![0].url);
  expect(restaurantJournalMenu(listing,content).items).toEqual([]);
  expect(journalMenuSource(content,listing.menuUrl).url).toBe(content.menuDocuments![0].url);
});
