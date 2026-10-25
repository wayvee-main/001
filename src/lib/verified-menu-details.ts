import type { DetailContent, DetailMenuItem } from './detail-content';

// Human-verified fallback for the official menu PDFs linked from Bocanova's
// current site, checked 2026-10-25. Never transfer to another map identity.
const dinner='https://www.bocanovaoakland.com/s/Dinner-Menu-040126.pdf';
const happy='https://www.bocanovaoakland.com/s/Happy-Hour-010626-For-the-Website.pdf';
const verifiedAt='2026-10-25T00:00:00Z';
const dish=(name:string,price:string,category:string,desc?:string,note?:string):DetailMenuItem=>({name,price,categories:[category],desc,note});
export const VERIFIED_MENU_DETAILS:Record<string,DetailContent>={
  'osm:2306696660':{
    version:1,sourceUrl:'https://www.bocanovaoakland.com/menu',verifiedAt,
    description:'Pan-American cooking, a raw bar and daily happy hour at 1111 Broadway.',
    menu:{url:dinner,title:'Dinner & happy-hour highlights',verifiedAt,note:'Dinner-menu prices unless marked happy hour. Confirm current availability with Bocanova.',items:[
      dish('Oysters on the half shell','$4.50 each','Raw bar','Spicy cocktail sauce','Dinner menu · minimum 3'),
      dish('Ahi tuna ceviche Nikkei style','$19','Raw bar','Avocado, mango, togarashi, cilantro'),
      dish('Ceviche verde tostadas','$19','Raw bar','Salmon, Petrale sole, cucumber, avocado'),
      dish('Peruvian ceviche clásico','$19 / $26','Raw bar'),
      dish('Blue crab deviled eggs','$20','Raw bar','Chipotle aioli'),
      dish('Salmon tiradito tostadas','$20','Raw bar'),
      dish('Mixed seafood ceviche','$22','Raw bar'),
      dish('Crispy Brussels sprouts','$15','Small plates'),
      dish('Smoked salmon beignets','$15','Small plates','Cucumber jam'),
      dish('Crispy fried cauliflower','$16','Small plates'),
      dish('Mushroom vegetarian empanadas','$16','Small plates'),
      dish('Shrimp empanadas','$16','Small plates'),
      dish('Beef empanadas','$18','Small plates','Braised brisket, green olives'),
      dish('Duck tostadas','$22','Small plates'),
      dish('Mango & avocado salad','$14','Salads'),
      dish('Mexican Caesar salad','$15','Salads'),
      dish('Portobello pozole verde','$17','Mains'),
      dish('Salt Spring mussels','$27','Mains','One pound'),
      dish('Fried oyster & shellfish gumbo','$34','Mains'),
      dish('Peruvian seafood stew','$34','Mains'),
      dish('Coconut seafood stew','$35','Mains'),
      dish('Blackened ahi tuna','$35','Mains'),
      dish('Wild scallops a la plancha','$39','Mains'),
      dish('Crispy whole branzino','$42','Mains'),
      dish('Peruvian-style roast chicken','$32 / $58','Mains'),
      dish('Grilled flatiron steak','$34','Mains'),
      dish('Chipotle shoulder pork chop','$34','Mains'),
      dish('Lomo saltado','$35','Mains'),
      dish('Braised short rib Durango','$48','Mains'),
      dish('2 Buck Shuck oysters','$2 each','Happy hour',undefined,'Daily 3–6 PM · minimum 6'),
      dish('Happy-hour salmon beignets','$8','Happy hour',undefined,'Daily 3–6 PM'),
      dish('Happy-hour crispy calamari','$9','Happy hour',undefined,'Daily 3–6 PM'),
      dish('Oyster po-boy sliders','$9','Happy hour',undefined,'Daily 3–6 PM'),
      dish('Happy-hour popcorn chicken','$9','Happy hour',undefined,'Daily 3–6 PM'),
      dish('Guacamole & chips','$9','Happy hour',undefined,'Daily 3–6 PM'),
      dish('Cheese quesadilla','$7','Happy hour',undefined,'Daily 3–6 PM'),
    ]},
    offers:[{title:'2 Buck Shuck',label:'Daily · 3–6 PM',description:'$2 oysters · minimum 6. From the official happy-hour menu.',url:happy}],
    links:[{label:'Dinner menu',url:dinner},{label:'Happy-hour menu',url:happy}],
  },
};
