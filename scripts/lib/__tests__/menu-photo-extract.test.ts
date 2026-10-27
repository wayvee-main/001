/** @jest-environment node */
import { discoverSources,extractMenuPhotos,menuFromText,stablePhotoUrl } from '../menu-photo-extract';
import { mergeRegionalDetails } from '../regional-details';

const identity={name:'A real kitchen',address:'12 Main Street',category:'restaurant'};
const base='https://venue.example/';
it('discovers official documents, galleries and merchant-linked stores without widening to arbitrary social profiles',()=>{
 const links=discoverSources('<a href="/dinner.pdf">Dinner</a><a href="/gallery">Photos</a><a href="https://www.ubereats.com/store/real-place/123">Order</a><a href="https://www.doordash.com/store/real-place-123/">Delivery</a><a href="https://www.instagram.com/p/ownedPost/">Our food</a><a href="https://www.instagram.com/random/">Profile</a>',base);
 expect(links.find(link=>link.document==='pdf')?.url).toBe(base+'dinner.pdf');
 expect(links.map(link=>link.kind)).toEqual(['official','official','ubereats','doordash','social']);
 expect(links.every(link=>link.trustedLink)).toBe(true);
});
it.each(['ubereats','doordash'])('keeps %s dish photos and delivery-price provenance with the actual item',provider=>{
 const url=`https://www.${provider}.com/store/real-place/123`;
 const data={'@type':'Restaurant',name:identity.name,address:{streetAddress:identity.address},menu:{items:[{name:'Noodle soup',displayPrice:'$17.50',description:'Published description',imageUrl:'https://cdn.example/soup.jpg'}]}};
 const result=extractMenuPhotos('<script type="application/json">'+JSON.stringify(data)+'</script>',url,identity,true);
 expect(result.content?.menu).toMatchObject({sourceKind:provider,pricingContext:'delivery'});
 expect(result.content?.menu?.items[0]).toMatchObject({name:'Noodle soup',price:'$17.50',image:'https://cdn.example/soup.jpg',imageSourceUrl:url});
 expect(result.menuPage).toBe(true);
 const wrong=extractMenuPhotos('<script type="application/json">'+JSON.stringify({...data,address:{streetAddress:'99 Other Avenue'}})+'</script>',url,identity,true);
 expect(wrong.content).toBeUndefined();
});
it('does not guess cents or publish unlinked platform goods without an identity match',()=>{
 const json={menu:{items:[{name:'Soup',price:1800,imageUrl:'https://cdn.example/soup.jpg'}]}};
 const html='<script type="application/json">'+JSON.stringify(json)+'</script>';
 expect(extractMenuPhotos(html,'https://www.ubereats.com/store/unknown/1',identity).content).toBeUndefined();
 expect(extractMenuPhotos(html,'https://www.ubereats.com/store/known/1',identity,true).content?.menu?.items[0].price).toBeUndefined();
});
it('reads semantic menus and content galleries, rejecting logos, stock and expiring social URLs',()=>{
 const html='<div class="food-item"><h3>Oyster plate</h3><span class="price">$18</span><img src="/dish.jpg" alt="Oyster plate"></div><img srcset="/small.jpg 300w, /large.jpg 1200w" alt="Dining room"><div style="background-image:url(/room.jpg)"></div><img src="/logo.jpg"><img src="https://cdn.example/photo.jpg?expires=123">';
 const result=extractMenuPhotos(html,base+'menu',identity,true);
 expect(result.content?.menu?.items[0]).toMatchObject({name:'Oyster plate',price:'$18'});
 expect(result.content?.photos?.map(photo=>photo.url)).toEqual(expect.arrayContaining([base+'dish.jpg',base+'large.jpg',base+'room.jpg']));
 expect(result.content?.photos?.some(photo=>/logo|expires/.test(photo.url))).toBe(false);
 expect(stablePhotoUrl('https://images.unsplash.com/stock.jpg',base)).toBeUndefined();
});
it('keeps a featured product snapshot partial while retaining the real PDF link',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Soup',offers:{price:'12',priceCurrency:'USD'}})+'</script><a href="/dinner.pdf">Full dinner menu</a>';
 const result=extractMenuPhotos(html,base,identity,true);
 expect(result.menuPage).toBe(false);expect(result.content?.menuDocuments?.[0]).toMatchObject({url:base+'dinner.pdf',format:'pdf'});
});
it('does not mistake a normal Wix captcha-library reference for an access challenge',()=>{
 const html='<script>window.recaptchaSupport="captcha challenge-platform";</script><div data-hook="item.root"><h3 data-hook="item.name">Soup</h3><p data-hook="item.price">$12</p></div>';
 const result=extractMenuPhotos(html,base+'menu',identity,true);
 expect(result.blocked).toBe(false);expect(result.content?.menu?.items[0].name).toBe('Soup');
 expect(extractMenuPhotos('<title>Just a moment...</title><p>Verify you are human</p>',base,identity,true).blocked).toBe(true);
});
it('retains literal bare PDF prices and the item-specific minimum without guessing currency',()=>{
 const result=menuFromText('Oysters on the half shell - sauce (minimum of 3)     4.5 each\nAhi Tuna Ceviche - avocado     19',base+'menu.pdf',identity);
 expect(result?.menu?.items).toMatchObject([{name:'Oysters on the half shell',price:'4.5 each',desc:'sauce (minimum of 3)'},{name:'Ahi Tuna Ceviche',price:'19'}]);
});
it('reads only public venue-linked social post metadata and retains its source',()=>{
 const url='https://www.instagram.com/p/venueOwnedPost/';
 const result=extractMenuPhotos('<meta property="og:image" content="https://cdn.example/food.jpg">',url,identity,true);
 expect(result.content?.photos?.[0]).toMatchObject({url:'https://cdn.example/food.jpg',provider:'social',sourceUrl:url});
 expect(result.content?.menu).toBeUndefined();
});
it('parses only unambiguous same-line PDF/OCR names and prices with confidence gating',()=>{
 const lines='STARTERS\nSoup ........ $12\nSmall salad $8 Large $14\nUncertain noodle $18\nTotal $38';
 const confidence=new Map([['STARTERS',100],['Soup ........ $12',99],['Small salad $8 Large $14',99],['Uncertain noodle $18',60],['Total $38',99]]);
 const content=menuFromText(lines,base+'menu.pdf',identity,new Date(),confidence);
 expect(content?.menu?.items.map(item=>item.name)).toEqual(['Soup']);
 expect(content?.menu?.items[0]).toMatchObject({price:'$12',categories:['STARTERS']});
});
it('retains official menu prices when delivery photography arrives',()=>{
 const old={version:1 as const,sourceUrl:base,verifiedAt:'2026-10-27T00:00:00Z',menu:{url:base+'menu',sourceKind:'official' as const,pricingContext:'venue' as const,items:[{name:'Soup',price:'$12',categories:['Mains']}]}};
 const incoming={...old,menu:{...old.menu,url:'https://www.doordash.com/store/place/123',sourceKind:'doordash' as const,pricingContext:'delivery' as const,items:[{name:'Soup',price:'$18',categories:['Mains']}]},photos:[{url:'https://cdn.example/soup.jpg',sourceUrl:'https://www.doordash.com/store/place/123',provider:'doordash' as const}]};
 const merged=mergeRegionalDetails(old,incoming);
 expect(merged?.menu?.items[0].price).toBe('$12');expect(merged?.menu?.sourceKind).toBe('official');expect(merged?.photos?.[0].provider).toBe('doordash');
});
