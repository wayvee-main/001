import { RESTAURANTS } from '@/lib/data';
import { restaurantForPlace } from '@/lib/catalog-identity';
import { parseDetailContent, detailContentFacts } from '@/lib/detail-content';
import { menuListingForPlace, restaurantJournalMenu, eventJournalDetails } from '@/lib/detail-journal';
import { EVENTS } from '@/lib/events';
import { extractOfficialMenu } from '../../../scripts/lib/menu-schema';
import { ticketmasterDetailContent } from '../../../scripts/lib/ticketmaster-details';

const now=new Date('2026-10-25T12:00:00Z');
const base={version:1,sourceUrl:'https://venue.example/menu',verifiedAt:now.toISOString()};

describe('Actual detail goods',()=>{
 it('connects a map identity to the matching restaurant without moving another branch’s menu',()=>{
  const same={id:'osm:1585385137',name:'Shooting Star Cafe',address:'1022 Webster Street'};
  const menu=menuListingForPlace(same,Object.values(RESTAURANTS),'oakland');
  expect(menu?.id).toBe('shootingstar');expect(restaurantJournalMenu(menu!).items.length).toBeGreaterThan(0);
  expect(restaurantForPlace({...same,address:'1022 Broadway'},Object.values(RESTAURANTS),'oakland')).toBeUndefined();
  expect(restaurantForPlace(same,Object.values(RESTAURANTS),'san-francisco')).toBeUndefined();
  expect(restaurantForPlace({...same,address:null},Object.values(RESTAURANTS),'oakland')).toBeUndefined();
 });
 it('reads published backend menus for an uncurated place, preserving the actual price and photo',()=>{
  const content=parseDetailContent({...base,menu:{url:'https://venue.example/menu',items:[{name:'Published dish',price:'$13.50',image:'https://venue.example/dish.jpg',categories:['Mains']}]}})!;
  const source=menuListingForPlace({id:'osm:new',name:'A new kitchen',address:'12 Main St',detailContent:content},[],'oakland');
  expect(restaurantJournalMenu(source!,content).items[0]).toMatchObject({name:'Published dish',price:'$13.50',image:'https://venue.example/dish.jpg'});
  expect(detailContentFacts(content)[0].value).toContain('$13.50');
 });
 it('rejects malformed cached payloads, script links and expired offers',()=>{
  expect(parseDetailContent(null)).toBeUndefined();expect(parseDetailContent({version:2})).toBeUndefined();
  const content=parseDetailContent({...base,links:[{label:'Bad',url:'javascript:alert(1)'}],offers:[{title:'Yesterday',label:'Offer',description:'An old offer',url:base.sourceUrl,expiresAt:'2026-10-24'}]},now)!;
  expect(content.links).toEqual([]);expect(content.offers).toEqual([]);
 });
 it('keeps valid sparse data without inventing a price, dish image or artist biography',()=>{
  const content=parseDetailContent({...base,menu:{url:base.sourceUrl,items:[{name:'Soup'}]},artists:[{name:'An artist'}]})!;
  expect(content.menu!.items[0].price).toBeUndefined();expect(content.menu!.items[0].image).toBeUndefined();expect(content.artists![0].description).toBeUndefined();
 });
 it('retains delivery pricing/photo provenance and a public PDF menu without inventing parsed items',()=>{
  const content=parseDetailContent({...base,menu:{url:'https://www.doordash.com/store/real-place-123/',sourceKind:'doordash',sourceLabel:'DoorDash',pricingContext:'delivery',items:[{name:'Soup',price:'$15',categories:['Mains'],sourceUrl:'https://www.doordash.com/store/real-place-123/',imageSourceUrl:'https://www.doordash.com/store/real-place-123/'}]},photos:[{url:'https://venue.example/dish.jpg',sourceUrl:'https://venue.example/gallery',sourceLabel:'Official gallery',provider:'official',attribution:'The venue'}],menuDocuments:[{url:'https://venue.example/dinner.pdf',title:'Dinner menu',format:'pdf',sourceUrl:base.sourceUrl,verifiedAt:base.verifiedAt},{url:'javascript:alert(1)',title:'Bad',format:'pdf'}]})!;
  expect(content.menu).toMatchObject({sourceKind:'doordash',sourceLabel:'DoorDash',pricingContext:'delivery'});
  expect(content.menu!.items[0].imageSourceUrl).toBe(content.menu!.url);
  expect(content.photos![0]).toMatchObject({provider:'official',attribution:'The venue'});
  expect(content.menuDocuments).toHaveLength(1);
  const documentOnly=parseDetailContent({...base,menuDocuments:content.menuDocuments})!;
  expect(documentOnly.menu).toBeUndefined();expect(documentOnly.menuDocuments![0].format).toBe('pdf');
 });
 it('extracts a semantic Wix menu with the correct item, image and section association',()=>{
  const html='<section data-hook="section.container"><h2 data-hook="section.name">Noodles</h2><div data-hook="item.root"><p data-hook="item.name">Noodle soup</p><p data-hook="item.description">Broth &amp; greens</p><p data-hook="item.price">$14.95</p><img src="/soup.jpg" alt="Noodle soup"></div></section>';
  const content=extractOfficialMenu(html,'https://venue.example/menu',{name:'A kitchen',address:'12 Main St'},now)!;
  expect(content.menu!.items).toEqual([{name:'Noodle soup',desc:'Broth & greens',price:'$14.95',image:'https://venue.example/soup.jpg',note:undefined,categories:['Noodles']}]);
 });
 it('rejects schema from another location even when the brand is the same',()=>{
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Restaurant',name:'A kitchen',address:{streetAddress:'99 Elsewhere Road'},hasMenu:{'@type':'Menu',hasMenuItem:{'@type':'MenuItem',name:'Soup',offers:{price:'12',priceCurrency:'USD'}}}})+'</script>';
  expect(extractOfficialMenu(html,'https://venue.example/menu',{name:'A kitchen',address:'12 Main Street'},now)).toBeUndefined();
 });
 it('retains Ticketmaster attraction photos, venue content and complete notes from the same event',()=>{
  const raw={url:'https://tickets.example/show',pleaseNote:'The full published venue note.',_embedded:{attractions:[{name:'Artist One',images:[{url:'https://artist.example/photo.jpg',width:1200}]},{name:'Artist Two'}],venues:[{name:'A real room',address:{line1:'12 Main St'},city:{name:'Oakland'},images:[{url:'https://room.example/photo.jpg'}]}]}};
  const content=ticketmasterDetailContent(raw,now)!;
  expect(content.artists![0].image).toBe('https://artist.example/photo.jpg');expect(content.venue!.image).toBe('https://room.example/photo.jpg');expect(content.notes![0].body).toBe(raw.pleaseNote);
  const details=eventJournalDetails({...EVENTS.bonobo,sourceUrl:raw.url,detailContent:content});
  expect(details.artists.map(artist=>artist.name)).toEqual(['Artist One','Artist Two']);expect(details.upgrade).toBeUndefined();
 });
});
