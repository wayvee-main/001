/** @jest-environment node */
import { extractOfficialMenu } from '../menu-schema';

it('uses the source dish photo rather than Wix’s blurred, cropped lazy preview',()=>{
 const html='<div data-hook="item.root"><p data-hook="item.name">Golden Rolls</p><p data-hook="item.price">$6</p><img src="https://static.wixstatic.com/media/actual-dish.jpg/v1/fill/w_147,h_98,blur_2/actual-dish.jpg" alt="Golden Rolls"></div>';
 const result=extractOfficialMenu(html,'https://venue.example/menu',{name:'A kitchen'});
 expect(result?.menu?.items[0].image).toBe('https://static.wixstatic.com/media/actual-dish.jpg');
 expect(result?.photos?.[0].url).toBe('https://static.wixstatic.com/media/actual-dish.jpg');
});
