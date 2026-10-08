// Wayvee — verified discovery data for Downtown Oakland.
// Device location can refine directions, while Downtown Oakland remains the neutral trip anchor.
// Everything is hand-picked around Broadway / Old Oakland / Uptown / Jack London.
// Every restaurant/venue/event below was checked against its own official site or a
// major listing (Yelp/OpenTable/the venue's own calendar) on Jul 13, 2026 — see each
// entry's sourceUrl. Nothing here is invented; entries without verified depth (full
// menu, reviews) say so honestly rather than faking it.

import { EVENTS, type ScoperEvent } from './events';

export const GUEST = {
  name: 'Guest',
  initials: 'G',
  anchor: 'Downtown Oakland',
  city: 'Oakland',
};

export interface DeliveryQuote {
  provider: string;
  fee: string;
  eta: string;
  best?: boolean;
  /** Exact ordering URL for this provider, when known. Falls back to a generic provider link. */
  url?: string;
}

export interface RestaurantMenuItem {
  name: string;
  desc?: string;
  price?: string;
  note?: string;
  categories: RestaurantMenuCategory[];
  /** Explicit dish photo; when absent, menuItemImage falls back to the editorial dish pool. */
  image?: string;
}

export type RestaurantMenuCategory = 'Starters' | 'Mains' | 'Drinks' | 'Value';

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  price: string;
  distanceLabel: string;
  image: string;
  dishImage: string;
  /** Optional snapshot. Omit rather than inventing a score when no licensed source is represented. */
  rating?: number;
  hours?: string;
  hoursShort?: string;
  /** Planning estimate for pickup readiness, not a live merchant promise. */
  readyEstimate: string;
  detailFacts: { label: string; value: string }[];
  highlightsLabel: string;
  popularDishes: { name: string; price?: string }[];
  menuHighlights: RestaurantMenuItem[];
  menuUrl: string;
  hasDelivery: boolean;
  /** Stable late-hours signal used by the Open late filter; exact hours remain visible. */
  openLate: boolean;
  delivery?: DeliveryQuote[];
  address: string;
  sourceUrl: string;
  /** Direct, verified handoff for the detail screen's primary action. */
  primaryAction: { label: 'Delivery' | 'Pickup' | 'Order' | 'Menu' | 'Official site'; url: string };
  orderUrl?: string;
  /** Real reservation link (e.g. OpenTable). Only set where verified — the Reserve action hides otherwise. */
  reserveUrl?: string;
  /** Extra factual discovery terms used by full-text search without cluttering the detail screen. */
  searchTags?: string[];
}

/** "Thai · $$ · 0.7 mi[ · Delivery]" — the cuisine/price/distance line built
 * inline (with drifting field order/separators) on Home, the food hub,
 * collections, plan launchpad, and the restaurant detail screen. One
 * formatter so "no invented data" stays enforced at a single call site: it
 * only ever joins fields that are already present, never estimates one. */
export function restaurantMetaLine(
  restaurant: Pick<Restaurant, 'cuisine' | 'price' | 'distanceLabel' | 'hasDelivery'>,
  opts?: { delivery?: boolean },
): string {
  return [restaurant.cuisine, restaurant.price, restaurant.distanceLabel, opts?.delivery && restaurant.hasDelivery ? 'Delivery' : null]
    .filter(Boolean)
    .join(' · ');
}

export const RESTAURANTS: Record<string, Restaurant> = {
  // Official location/menu checked Jul 13, 2026: farmhousethai.com Oakland pages + OpenTable listing.
  farmhouse: {
    id: 'farmhouse', name: 'Farmhouse Kitchen', cuisine: 'Thai', price: '$$', distanceLabel: '0.7 mi',
    rating: 4.4, hours: 'Lunch and dinner daily', hoursShort: 'dinner till 8:30–9 PM', readyEstimate: '25–35 min', hasDelivery: true, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Lunch & dinner daily · till 8:30–9 PM' },
      { label: 'Service', value: 'Dine-in · pickup · delivery · catering' },
      { label: 'Phone', value: '(510) 419-0541' },
      { label: 'Reservations', value: 'Online via OpenTable' },
    ],
    highlightsLabel: 'Most ordered',
    popularDishes: [
      { name: 'Pad Thai', price: '$22' },
      { name: 'Thai Fried Rice', price: '$22' },
      { name: 'Yellow Curry', price: '$21' },
    ],
    menuHighlights: [
      { name: 'Pad Thai', desc: 'Thin rice noodles, egg, bean sprouts, chive, shallot and peanuts', price: '$22', categories: ['Mains'] },
      { name: 'Thai Fried Rice', desc: 'Egg, onion, tomato, Asian broccoli, green onion and cilantro', price: '$22', categories: ['Mains'] },
      { name: 'Yellow Curry', desc: 'Potato, white onion and crispy shallots', price: '$21', categories: ['Mains'] },
      { name: 'Pad See You', desc: 'Flat rice noodles, egg, carrot and Asian broccoli', price: '$22', categories: ['Mains'] },
      { name: 'Crispy Egg Rolls', desc: 'Crisp vegetable rolls with peanut sauce', price: '$20', categories: ['Starters'] },
      { name: 'Tom Yum', desc: 'Spicy-sour soup with lemongrass, lime and mushroom', price: '$12', categories: ['Starters', 'Value'] },
      { name: 'Thai Iced Tea', price: '$8', categories: ['Drinks', 'Value'] },
      { name: 'Mango Sticky Rice', desc: 'Coconut sticky rice with seasonal mango', price: '$15', categories: ['Value'] },
    ],
    menuUrl: 'https://farmhousethai.com/menu/oakland',
    address: '336 Water St, Oakland, CA 94607',
    sourceUrl: 'https://farmhousethai.com/oakland',
    primaryAction: { label: 'Order', url: 'https://farmhousethai.com/menu/oakland?dialogState=orderDetails' },
    orderUrl: 'https://farmhousethai.com/menu/oakland?dialogState=orderDetails',
    reserveUrl: 'https://www.opentable.com/r/farmhouse-kitchen-thai-cuisine-oakland',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Khao_soi_nuea.jpg?width=900',
    dishImage: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Khao_soi_nuea.jpg?width=900',
  },
  // Verified Jul 2026: 510 9th St, Swan's Market · closed Sundays · Oyster Hour Tue–Fri 3–5 PM.
  cookfarmer: {
    id: 'cookfarmer', name: 'The Cook and Her Farmer', cuisine: 'Oysters', price: '$$', distanceLabel: '0.3 mi',
    rating: 4.4, hours: 'Mon–Sat · Sunday closed', hoursShort: 'dinner Tue–Sat', readyEstimate: '20–30 min',
    detailFacts: [
      { label: 'Hours', value: 'Mon 11 AM–4 PM · Tue–Sat till 8 PM · Sun closed' },
      { label: 'Service', value: 'Garden seating · online to-go' },
      { label: 'Oyster hour', value: 'Tue–Fri 3–5 PM' },
      { label: 'Reservations', value: 'Walk-ins only' },
      { label: 'Phone', value: '(510) 285-6140' },
    ],
    highlightsLabel: 'Featured items',
    popularDishes: [
      { name: 'Kale & Quinoa Salad', price: '$17' },
      { name: 'Big Sur Melt', price: '$22' },
      { name: 'Mussels with Fries', price: '$28' },
    ],
    // Full menu + photos verified Jul 20, 2026 on the restaurant's own Square ordering page.
    menuHighlights: [
      { name: 'Kale & Quinoa Salad', desc: 'Organic kale, red cabbage, quinoa, toasted pumpkin seeds, orange, currants, citrus-cumin vinaigrette', price: '$17–$27', categories: ['Starters', 'Value'], image: 'https://126808869.cdn6.editmysite.com/uploads/1/2/6/8/126808869/26KNKIYBLVILISA7DHHHP3TI.jpeg?width=400&optimize=medium' },
      { name: 'The Burger', desc: 'Grass-fed patty on an Acme roll, house aioli, pickled onions, cucumber pickles, butter lettuce', price: '$16–$20', categories: ['Mains'], image: 'https://126808869.cdn6.editmysite.com/uploads/1/2/6/8/126808869/R5K7MUFC6JPQENAOJOHOPXKU.jpeg?width=400&optimize=medium' },
      { name: 'Po’Boy', desc: 'Cornmeal fried oysters on an Acme roll, spicy aioli, Memphis-style slaw, house pickles', price: '$21', categories: ['Mains'], image: 'https://126808869.cdn6.editmysite.com/uploads/1/2/6/8/126808869/EQOXD5BCYFICJ6FRS7DST2NB.jpeg?width=400&optimize=medium' },
      { name: 'Kennebec Fries', desc: 'Hand-cut, non-GMO sunflower oil, dedicated fryer — add aioli', price: '$8.75', categories: ['Starters', 'Value'], image: 'https://126808869.cdn6.editmysite.com/uploads/1/2/6/8/126808869/BFFEOUAHMJ37MQMKXIMQGFO4.jpeg?width=400&optimize=medium' },
      { name: 'Oysters on the Half Shell', desc: 'Fresh rotating oyster selection', categories: ['Starters'] },
      { name: 'Fried Oysters (4)', desc: 'Cornmeal-fried, with spicy aioli', price: '$15', categories: ['Starters'] },
      { name: 'House Chips', desc: 'Housemade Kennebec potato chips', price: '$4', categories: ['Starters', 'Value'] },
      { name: 'Pickle Plate', desc: 'House pickles and Castelvetrano olives, sea salt, olive oil', price: '$7', categories: ['Starters', 'Value'] },
      { name: 'Olives', desc: 'Castelvetrano, olive oil, sea salt', price: '$4', categories: ['Starters', 'Value'] },
      { name: 'Memphis Style Slaw', desc: 'Tangy vinegar-dressed slaw, served as a side', price: '$6', categories: ['Starters', 'Value'] },
      { name: 'Avocado Toast', desc: 'Brokaw avocado, labneh, pickled shallots, arugula on Acme levain — load it with prosciutto or smoked salmon', price: '$10–$18.75', categories: ['Starters'] },
      { name: 'Chicken Liver Toast', desc: 'House pâté on grilled levain, pickled shallots, arugula', price: '$14.50', categories: ['Starters'] },
      { name: 'Quiche', desc: 'Made daily with market vegetables and organic eggs in a buttermilk crust', price: '$8.75+', categories: ['Starters', 'Value'] },
      { name: 'Daily Soup', desc: 'Made in house, vegetarian-based unless noted — add toasted bread', price: '$8.75–$16', categories: ['Starters', 'Value'] },
      { name: 'Chorizo Platter', desc: 'Dried Spanish chorizo, Manchego, house pickles, toasted levain', price: '$19.50', categories: ['Starters'] },
      { name: 'Arugula Salad', desc: 'Organic arugula, fennel, radish, dry jack, champagne vinaigrette', price: '$8.50–$23.50', categories: ['Starters', 'Value'] },
      { name: 'Market Salad', desc: 'Little gems, shaved vegetables, cherry tomatoes, dry jack, goddess dressing', price: '$8–$16', categories: ['Starters', 'Value'] },
      { name: 'Big Sur Melt', desc: 'Grilled cheese with Gulf shrimp and green onion', price: '$22', categories: ['Mains'] },
      { name: 'Mussels with Fries', desc: 'Beer broth, grilled bread and aioli', price: '$28', categories: ['Mains'] },
      { name: 'Harissa Chicken', desc: 'Brined half chicken, harissa, greens and crispy potatoes', price: '$27', categories: ['Mains'] },
      { name: 'Coffee', categories: ['Drinks', 'Value'] },
      { name: 'Sparkling Water', categories: ['Drinks'] },
    ],
    menuUrl: 'https://www.thecookandherfarmer.com/menu',
    hasDelivery: true, openLate: false,
    address: '510 9th St, Oakland, CA 94607',
    sourceUrl: 'https://www.thecookandherfarmer.com/',
    primaryAction: { label: 'Order', url: 'https://www.thecookandherfarmer.com/s/order' },
    orderUrl: 'https://www.thecookandherfarmer.com/s/order',
    image: 'https://www.thecookandherfarmer.com/uploads/b/1a4ca38913f8c48093a748206be9e44a1e725d902ddcc3ae613f7cf78dd36a80/background_image-2_1599184591.jpg',
    dishImage: 'https://www.thecookandherfarmer.com/uploads/b/1a4ca38913f8c48093a748206be9e44a1e725d902ddcc3ae613f7cf78dd36a80/background_image-2_1599184591.jpg',
  },
  // Verified Jul 2026: 2600 Telegraph Ave · Sun–Thu till 9:30 PM, Fri–Sat till 11:30 PM.
  gogi: {
    id: 'gogi', name: 'Gogi Time', cuisine: 'Korean BBQ', price: '$$', hours: 'Daily from noon', hoursShort: 'till 11:30 PM Fri–Sat', readyEstimate: '25–35 min',
    detailFacts: [
      { label: 'Hours', value: 'Sun–Thu noon–9:30 PM · Fri–Sat noon–11:30 PM' },
      { label: 'Service', value: 'Pickup · delivery' },
      { label: 'Phone', value: '(510) 834-5757' },
    ],
    highlightsLabel: 'Featured items',
    popularDishes: [
      { name: 'Spicy Pork', price: '$30' },
      { name: 'Crispy Fried Chicken', price: '$26' },
      { name: 'Korean Pancake', price: '$14' },
    ],
    menuHighlights: [
      { name: 'Spicy Pork', desc: 'Grilled and marinated in house spicy sauce; feeds 2–3', price: '$30', categories: ['Mains'] },
      { name: 'Crispy Fried Boneless Chicken', desc: 'Gogi-style Korean fried chicken with sides and rice', price: '$26', categories: ['Mains'] },
      { name: 'Savory Korean Pancake', desc: 'Korean crepe with kimchi, vegetable or seafood choice', price: '$14', categories: ['Starters'] },
      { name: 'Stone Pot Dolsot Bibimbap', desc: 'Vegetables with beef, spicy pork or chicken over rice with egg', price: '$20', categories: ['Mains'] },
      { name: 'Fried Potstickers', desc: 'Beef, vegetable or kimchi dumplings with glass noodles', price: '$11', categories: ['Starters', 'Value'] },
      { name: 'Corn Cheese', desc: 'Sweet corn with mozzarella', price: '$11', categories: ['Starters', 'Value'] },
      { name: 'Lychee Sour', price: '$10', categories: ['Drinks'] },
      { name: 'Coca-Cola', price: '$4', categories: ['Drinks', 'Value'] },
    ],
    menuUrl: 'https://www.toasttab.com/local/order/gogi-time/r-001ba650-7625-4beb-b501-76ea8cdca667',
    rating: 4.3, distanceLabel: '8 min ride', hasDelivery: true, openLate: true,
    address: '2600 Telegraph Ave, Oakland, CA 94612',
    sourceUrl: 'https://order.toasttab.com/online/gogi-time',
    primaryAction: { label: 'Order', url: 'https://order.toasttab.com/online/gogi-time' },
    orderUrl: 'https://order.toasttab.com/online/gogi-time',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Korean_barbecue-Grill_and_banchan.jpg?width=1200',
    dishImage: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Korean_barbecue-Grill_and_banchan.jpg?width=1200',
  },
  // Verified Jul 2026: 2138 International Blvd · daily 9 AM–1 AM (tacossinaloaoakland.com, Yelp)
  sinaloa: {
    id: 'sinaloa', name: 'Tacos Sinaloa', cuisine: 'Mexican', price: '$', hours: 'Daily 9 AM–1 AM', hoursShort: 'till 1 AM daily', readyEstimate: '15–25 min',
    detailFacts: [
      { label: 'Hours', value: 'Daily · 9 AM–1 AM' },
      { label: 'Service', value: 'Dine-in · takeout · official online pickup' },
      { label: 'Online pickup', value: 'Toast ordering closes at midnight' },
      { label: 'Phone', value: '(510) 535-1206' },
    ],
    highlightsLabel: 'Menu highlights',
    popularDishes: [
      { name: 'Taco Asada', price: '$4' },
      { name: 'Burrito Asada', price: '$15' },
      { name: 'Ceviche Tostada', price: '$9' },
    ],
    menuHighlights: [
      { name: 'Taco Asada', desc: 'Steak, cilantro, onions and salsa', price: '$4', categories: ['Mains', 'Value'] },
      { name: 'Burrito Asada', desc: 'Steak, rice, beans, sour cream, cheese and salsa', price: '$15', categories: ['Mains'] },
      { name: 'Taco Camarón', desc: 'Shrimp, pico de gallo and salsa', price: '$4', categories: ['Mains', 'Value'] },
      { name: 'Tostada Ceviche de Camarón', desc: 'Shrimp ceviche tostada', price: '$9', categories: ['Starters', 'Value'] },
      { name: 'Quesadilla de Carne', desc: 'Choice of meat with lettuce, tomato and sour cream', categories: ['Mains'] },
      { name: 'Taco Veggie', desc: 'Rice, beans, vegetables, cheese and salsa', categories: ['Starters', 'Value'] },
      { name: 'Aguas Frescas', categories: ['Drinks'] },
      { name: 'Jarritos', categories: ['Drinks', 'Value'] },
    ],
    menuUrl: 'https://tacossinaloaoakland.com/menu',
    rating: 4.5, distanceLabel: '10 min ride', hasDelivery: false, openLate: true,
    address: '2138 International Blvd, Oakland, CA 94606',
    sourceUrl: 'https://tacossinaloaoakland.com/',
    primaryAction: { label: 'Pickup', url: 'https://order.toasttab.com/online/tacos-sinaloa-1-2138-international-boulevard' },
    orderUrl: 'https://order.toasttab.com/online/tacos-sinaloa-1-2138-international-boulevard',
    image: 'https://static1.squarespace.com/static/609da33f7eded45e1950ce1f/t/60ba986c886af23c14790de8/1622841452095/TacosSinaloa_Lo--10.jpg?format=900w',
    dishImage: 'https://static1.squarespace.com/static/609da33f7eded45e1950ce1f/t/60ba986c886af23c14790de8/1622841452095/TacosSinaloa_Lo--10.jpg?format=900w',
  },
  // Verified Jul 2026: 1736 Telegraph Ave · Sun 11 AM–9 PM · happy hour 3–5 & 8–close (itaniramen.com)
  itani: {
    id: 'itani', name: 'Itani Ramen', cuisine: 'Ramen', price: '$$', hours: 'Lunch and dinner daily', hoursShort: 'till 9:30 PM Fri–Sat', readyEstimate: '20–30 min',
    detailFacts: [
      { label: 'Hours', value: 'Mon–Thu & Sun 11:30 AM–9 PM · Fri–Sat till 9:30 PM' },
      { label: 'Service', value: 'Dine-in · pickup · delivery' },
      { label: 'Happy hour', value: '3–5 PM · 8 PM–close' },
      { label: 'Phone', value: '(510) 788-7489' },
    ],
    highlightsLabel: 'Menu highlights',
    popularDishes: [
      { name: 'Miso Pork', price: '$20' },
      { name: 'Spicy Shrimp Ramen', price: '$21' },
      { name: 'Oxtail Ramen', price: '$22' },
    ],
    menuHighlights: [
      { name: 'Miso Pork', desc: 'Chashu pork belly, spinach, bean sprouts, green onions and egg; miso pork broth', price: '$20', categories: ['Mains'] },
      { name: 'Chicken Ramen', desc: 'Sesame chicken, lotus root, corn, spinach, sprouts and egg', price: '$20', categories: ['Mains'] },
      { name: 'Veggie Ramen', desc: 'Squash, broccolini, spinach, sprouts and egg; sesame-miso broth', price: '$19', categories: ['Mains'] },
      { name: 'Spicy Shrimp Ramen', desc: 'Garlic shrimp, Calabrian chile oil, bamboo shoots, greens and egg', price: '$21', categories: ['Mains'] },
      { name: 'Pork Gyoza', desc: 'Traditional griddled dumplings', categories: ['Starters', 'Value'] },
      { name: 'Veggie Gyoza', desc: 'Traditional griddled dumplings', categories: ['Starters', 'Value'] },
      { name: 'Japanese Highball', categories: ['Drinks'] },
      { name: 'Sake', categories: ['Drinks', 'Value'] },
    ],
    menuUrl: 'https://www.itaniramen.com/dine-in',
    rating: 4.2, distanceLabel: '14 min walk', hasDelivery: true, openLate: false,
    address: '1736 Telegraph Ave, Oakland, CA 94612',
    sourceUrl: 'https://www.itaniramen.com/',
    primaryAction: { label: 'Order', url: 'https://order.toasttab.com/online/itani-ramen' },
    orderUrl: 'https://order.toasttab.com/online/itani-ramen',
    image: 'https://static1.squarespace.com/static/54c0429de4b07740895e80d1/t/5f87e35fb8ad02204adb919b/1602741092695/%40dandy.eats.jpg?format=900w',
    dishImage: 'https://static1.squarespace.com/static/54c0429de4b07740895e80d1/t/5f87e35fb8ad02204adb919b/1602741092695/%40dandy.eats.jpg?format=900w',
  },
  // Verified Jul 2026: 3318 Lakeshore Ave · open 24 hours, 365 days (Yelp, colonialdonuts.shop)
  colonial: {
    id: 'colonial', name: 'Colonial Donuts', cuisine: 'Bakery', price: '$', hours: 'Open 24 hours daily', hoursShort: 'open 24 hours', readyEstimate: '5–10 min at counter',
    detailFacts: [
      { label: 'Hours', value: 'Open 24 hours · every day' },
      { label: 'Service', value: 'Walk-in counter · takeout' },
      { label: 'Phone', value: '(510) 893-2503' },
    ],
    highlightsLabel: 'Chef’s selections',
    popularDishes: [
      { name: 'Apple Fritter' },
      { name: 'Donut Holes' },
      { name: 'Custard-Filled French Cruller' },
    ],
    menuHighlights: [
      { name: 'Raised Donut', categories: ['Mains', 'Value'] },
      { name: 'Old Fashioned', categories: ['Mains', 'Value'] },
      { name: 'Apple Fritter', categories: ['Mains'] },
      { name: 'Custard-Filled French Cruller', categories: ['Mains'] },
      { name: 'Plain Croissant', categories: ['Starters', 'Value'] },
      { name: 'Bagel with Cream Cheese', price: '$4', categories: ['Starters', 'Value'] },
      { name: 'Regular Coffee', price: '$2', categories: ['Drinks', 'Value'] },
      { name: 'Thai Iced Tea', price: '$6', categories: ['Drinks'] },
    ],
    menuUrl: 'https://colonialdonuts.shop/menu',
    rating: 4.5, distanceLabel: '8 min ride', hasDelivery: false, openLate: true,
    address: '3318 Lakeshore Ave, Oakland, CA 94610',
    sourceUrl: 'https://colonialdonuts.shop/',
    primaryAction: { label: 'Menu', url: 'https://colonialdonuts.shop/menu' },
    image: 'https://colonialdonuts.shop/public/media/colonialdonuts-shop/8.jpg',
    dishImage: 'https://colonialdonuts.shop/public/media/colonialdonuts-shop/8.jpg',
  },
  // Official site checked Jul 19, 2026: dinner hours, menu, ordering and OpenTable handoff.
  mua: {
    id: 'mua', name: 'MUA Oakland', cuisine: 'Californian', price: '$$', distanceLabel: '12 min walk',
    hours: 'Tue–Thu & Sun 5–10 PM · Fri–Sat till 11 PM', hoursShort: 'till 11 PM Fri–Sat', readyEstimate: '20–35 min', hasDelivery: true, openLate: true,
    detailFacts: [
      { label: 'Hours', value: 'Tue–Thu & Sun 5–10 PM · Fri–Sat 5–11 PM · Monday closed' },
      { label: 'Service', value: 'Dinner · bar menu · pickup · reservations · walk-ins' },
      { label: 'Bar menu', value: 'All night Tue–Thu & Sun · 5–7 PM Fri–Sat' },
      { label: 'Phone', value: '(510) 238-1100' },
    ],
    highlightsLabel: 'Menu highlights',
    popularDishes: [
      { name: 'Fried Chicken' },
      { name: 'Blackened Catfish' },
      { name: 'One Pound Rib-Eye' },
    ],
    menuHighlights: [
      { name: 'Crispy Tofu', desc: 'Black bean–sweet chili sauce', categories: ['Starters', 'Value'] },
      { name: 'Brussels Sprouts', desc: 'Brown butter', categories: ['Starters'] },
      { name: 'Chicken Wings', desc: 'Citrus, chili, fish sauce and mint', categories: ['Starters'] },
      { name: 'Blackened Catfish', desc: 'Dirty rice and aioli', categories: ['Mains'] },
      { name: 'Fried Chicken', desc: 'Cornbread and coleslaw', categories: ['Mains'] },
      { name: 'One Pound Rib-Eye', desc: 'Fries and herb butter', categories: ['Mains'] },
      { name: 'Pecan Tart', desc: 'Vanilla ice cream and chocolate sauce', categories: ['Value'] },
      { name: 'Baby Girl', desc: 'Gin, coconut, lime and blackcurrant', categories: ['Drinks'] },
    ],
    menuUrl: 'https://www.muaoakland.com/menu',
    address: '2442 Webster St, Oakland, CA 94612',
    sourceUrl: 'https://www.muaoakland.com/',
    primaryAction: { label: 'Order', url: 'https://muaoakland.namer.alohaonlineordering.com/' },
    orderUrl: 'https://muaoakland.namer.alohaonlineordering.com/',
    reserveUrl: 'https://www.opentable.com/r/mua-reservations-oakland?restref=30028&lang=en-US&ot_source=Restaurant%20website',
    image: 'https://images.squarespace-cdn.com/content/v1/6a0e3c0157e2e13d2e8153e6/9f51d2f5-9920-4ee3-b5b0-d4e8d9d7b99c/from-balcony-L-1.jpeg?format=1000w',
    dishImage: 'https://images.squarespace-cdn.com/content/v1/6a0e3c0157e2e13d2e8153e6/9f51d2f5-9920-4ee3-b5b0-d4e8d9d7b99c/from-balcony-L-1.jpeg?format=1000w',
  },
  // Official pages checked Jul 19, 2026: address, hours, current menu, ordering and reservations.
  jos: {
    id: 'jos', name: 'Jo’s Modern Thai', cuisine: 'Modern Thai', price: '$$$', distanceLabel: '12 min ride',
    hours: 'Wed–Sun lunch & dinner', hoursShort: 'dinner till 9:30 PM Fri–Sat', readyEstimate: '25–40 min', hasDelivery: true, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Wed–Sun lunch & dinner · Mon–Tue closed' },
      { label: 'Service', value: 'Dine-in · pickup · delivery · reservations' },
      { label: 'Cooking', value: 'Regional Thai flavors with Californian ingredients' },
      { label: 'Phone', value: '(510) 479-3167' },
    ],
    highlightsLabel: 'Signature items',
    popularDishes: [
      { name: 'Northern Thai Curry Noodles', price: '$19' },
      { name: 'Crab Fried Rice', price: '$24' },
      { name: 'Jo’s Famous Zaap Wings', price: '$17' },
    ],
    menuHighlights: [
      { name: 'Jo’s Famous Zaap Wings', desc: 'Fried chicken wings, house Zaap seasoning, lime zest and spicy mayo', price: '$17', categories: ['Starters'] },
      { name: 'Thai Dumplings', desc: 'Pork, shrimp, green onion and Thai chili sauce', price: '$14', categories: ['Starters', 'Value'] },
      { name: 'Northern Thai Curry Noodles', desc: 'Coconut curry broth, egg noodles and Hat Yai fried chicken', price: '$19', categories: ['Mains'] },
      { name: 'Drunken Noodle', desc: 'Brisket, ramen noodles, Thai basil and green peppercorn', price: '$27', categories: ['Mains'] },
      { name: 'Crab Fried Rice', desc: 'Egg, garlic, soy, cilantro, green onion and prik nam pla', price: '$24', categories: ['Mains'] },
      { name: 'Massaman Curry', desc: 'Fingerling potato, cabbage, squash, peanut and coconut', price: '$28', categories: ['Mains'] },
      { name: 'Butterfly Pea Lemonade', price: '$6', categories: ['Drinks', 'Value'] },
      { name: 'Sweet Blue Sticky Rice', desc: 'Mango sorbet, coconut cream and pandan rice crispies', price: '$14', categories: ['Value'] },
    ],
    menuUrl: 'https://www.josmodernthai.com/menus/',
    address: '3725 MacArthur Blvd, Oakland, CA 94619',
    sourceUrl: 'https://www.josmodernthai.com/',
    primaryAction: { label: 'Order', url: 'https://order.toasttab.com/online/jos-modern-thai' },
    orderUrl: 'https://order.toasttab.com/online/jos-modern-thai',
    reserveUrl: 'https://www.opentable.com/r/jos-modern-thai-oakland',
    image: 'https://images.getbento.com/accounts/a7942be3e85909d9aec58b3bc0c1b776/media/UDahgt7pQeiWoMiXGRQb_JMT_Food_091621_136.jpg?w=1200&fit=max&auto=compress,format&cs=origin',
    dishImage: 'https://images.getbento.com/accounts/a7942be3e85909d9aec58b3bc0c1b776/media/images/46496Lobster_Pad_Thai_butterflu_pea_glass_noodle_salad.jpg?w=1200&fit=crop&auto=compress,format&cs=origin',
  },
  // Official site and direct Toast menu checked Jul 19, 2026.
  bombera: {
    id: 'bombera', name: 'Bombera', cuisine: 'Mexican–Californian', price: '$$$', distanceLabel: '12 min ride',
    hours: 'Mon & Wed–Sat 5–9 PM', hoursShort: 'dinner till 9 PM', readyEstimate: '25–40 min', hasDelivery: false, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Dinner Mon & Wed–Sat 5–9 PM · Tuesday and Sunday closed' },
      { label: 'Service', value: 'Dine-in · reservations & walk-ins' },
      { label: 'Takeout', value: 'Available Thu–Sat until 8:30 PM; availability can change' },
      { label: 'Phone', value: '(510) 452-5900' },
    ],
    highlightsLabel: 'Current takeout highlights',
    popularDishes: [
      { name: 'Carnitas Dinner', price: '$29' },
      { name: 'Smoked Trout Tostadas', price: '$18' },
      { name: 'Fish Tacos', price: '$19' },
    ],
    menuHighlights: [
      { name: 'Chips, Salsa & Guacamole', price: '$8', categories: ['Starters', 'Value'] },
      { name: 'Charred Beets', desc: 'Lime, green chile and whipped pumpkin–sesame butter', price: '$12', categories: ['Starters', 'Value'] },
      { name: 'Smoked Trout Tostadas', price: '$18', categories: ['Starters'] },
      { name: 'Beef Tamales', desc: 'Limited, with salsa', price: '$12', categories: ['Starters', 'Value'] },
      { name: 'Pork Carnitas Tacos', price: '$18', categories: ['Mains'] },
      { name: 'Fish Tacos', desc: 'Chipotle crema and cabbage slaw', price: '$19', categories: ['Mains'] },
      { name: 'Carnitas Dinner', desc: 'Slow-cooked pork, Oaxacan black beans, guacamole salsa and tortillas', price: '$29', categories: ['Mains'] },
      { name: 'Strawberry Agua Fresca', price: '$4', categories: ['Drinks', 'Value'] },
    ],
    menuUrl: 'https://www.toasttab.com/local/order/bombera-oakland',
    address: '3459 Champion St, Oakland, CA 94602',
    sourceUrl: 'https://www.bomberaoakland.com/',
    primaryAction: { label: 'Pickup', url: 'https://www.toasttab.com/local/order/bombera-oakland' },
    orderUrl: 'https://www.toasttab.com/local/order/bombera-oakland',
    reserveUrl: 'https://resy.com/cities/oakland-ca/venues/bombera',
    image: 'https://images.squarespace-cdn.com/content/v1/60413d57bfa30c002d12270e/d5b386b2-480b-439a-8ed9-a453eba14898/Bombera-August2023-31.jpg?format=1000w',
    dishImage: 'https://images.squarespace-cdn.com/content/v1/60413d57bfa30c002d12270e/d5b386b2-480b-439a-8ed9-a453eba14898/Bombera-August2023-31.jpg?format=1000w',
  },
  // Official site and online menu checked Jul 19, 2026: daily midnight hours and dinner ordering until 11:30 PM.
  shootingstar: {
    id: 'shootingstar', name: 'Shooting Star Cafe', cuisine: 'Hong Kong cafe', price: '$$', distanceLabel: '10 min walk',
    hours: 'Daily 7:30 AM–midnight', hoursShort: 'till midnight daily', readyEstimate: '20–30 min', hasDelivery: true, openLate: true,
    detailFacts: [
      { label: 'Hours', value: 'Open daily · 7:30 AM–midnight' },
      { label: 'Late menu', value: 'Dinner menu listed daily until 11:30 PM' },
      { label: 'Service', value: 'Dine-in · pickup · delivery · online ordering' },
      { label: 'Phone', value: '(510) 251-9882' },
    ],
    highlightsLabel: 'Late-menu highlights',
    popularDishes: [
      { name: 'Wor Wonton Soup', price: '$14.95' },
      { name: 'Salt & Pepper Chicken Wings', price: '$10.95' },
      { name: 'Preserved Egg & Pork Porridge', price: '$15.95' },
    ],
    menuHighlights: [
      { name: 'Wor Wonton Soup', price: '$14.95', categories: ['Mains'] },
      { name: 'Salt & Pepper Chicken Wings', desc: 'Six-piece appetizer', price: '$10.95', categories: ['Starters', 'Value'] },
      { name: 'Preserved Egg & Pork Porridge', desc: 'Porridge combination with a side and hot beverage', price: '$15.95', categories: ['Mains'] },
      { name: 'Wonton Noodle Soup', desc: 'Choice of ramen, macaroni or wide noodle', price: '$12.95', categories: ['Mains', 'Value'] },
      { name: 'Beef Rice Noodle Roll', price: '$8.95', categories: ['Starters', 'Value'] },
      { name: 'Salt & Pepper Tofu', price: '$8.95', categories: ['Starters', 'Value'] },
      { name: 'Hong Kong Style Beverages', categories: ['Drinks'] },
      { name: 'Egg Puffs', categories: ['Value'] },
    ],
    menuUrl: 'https://www.shootingstarhkcafe.com/menu?menu=dinner-menu-1',
    address: '1022 Webster St, Oakland, CA 94607',
    sourceUrl: 'https://www.shootingstarhkcafe.com/',
    primaryAction: { label: 'Order', url: 'https://www.shootingstarhkcafe.com/order' },
    orderUrl: 'https://www.shootingstarhkcafe.com/order',
    image: 'https://static.wixstatic.com/media/1acdb3_4d4d10417428464daad3c52524a84943~mv2.jpg',
    dishImage: 'https://static.wixstatic.com/media/1acdb3_4d4d10417428464daad3c52524a84943~mv2.jpg',
  },
  // Official site checked Jul 19, 2026: Oakland tasting-menu restaurant with online reservations.
  commis: {
    id: 'commis', name: 'Commis', cuisine: 'Californian', price: '$$$', distanceLabel: '10 min ride',
    hours: 'Reservation-only dinner seatings', hoursShort: '10-course dinner', readyEstimate: 'Dine-in experience', hasDelivery: false, openLate: false,
    detailFacts: [
      { label: 'Experience', value: 'Ten-course tasting menu · allow 2.5–3 hours' },
      { label: 'Dietary menus', value: 'Vegetarian and pescatarian menus with 24-hour notice' },
      { label: 'Phone', value: '(510) 653-3902' },
    ],
    highlightsLabel: 'Dining formats',
    popularDishes: [{ name: 'Ten-course tasting menu' }, { name: 'Vegetarian tasting menu' }, { name: 'Global beverage pairing' }],
    menuHighlights: [
      { name: 'Ten-course tasting menu', desc: 'A nightly progression using Northern California ingredients', categories: ['Mains'] },
      { name: 'Vegetarian tasting menu', desc: 'Available with advance notice', categories: ['Mains'] },
      { name: 'Pescatarian tasting menu', desc: 'Available with advance notice', categories: ['Mains'] },
      { name: 'Global beverage pairing', desc: 'Optional pairing for the full menu', categories: ['Drinks'] },
    ],
    menuUrl: 'https://commisrestaurant.com/info/',
    address: '3859 Piedmont Ave, Oakland, CA 94611',
    sourceUrl: 'https://commisrestaurant.com/',
    primaryAction: { label: 'Menu', url: 'https://commisrestaurant.com/info/' },
    reserveUrl: 'https://www.opentable.com/r/commis-dining-room-reservations-oakland?restref=36649&lang=en-US&ot_source=Restaurant%20website',
    // commisrestaurant.com is unreachable (checked Jul 20, 2026) — photo from the MICHELIN Guide listing.
    image: 'https://prod-pics.guide.michelin.com/api/public/content/f3056e582ba046ffa05f03db771905a4.jpg?format=jpeg&w=900',
    dishImage: 'https://prod-pics.guide.michelin.com/api/public/content/f3056e582ba046ffa05f03db771905a4.jpg?format=jpeg&w=900',
  },
  // Official menu and hours checked Jul 19, 2026.
  burdell: {
    id: 'burdell', name: 'Burdell', cuisine: 'Soul food', price: '$$$', distanceLabel: '12 min ride',
    hours: 'Wed–Sun dinner · Sunday brunch', hoursShort: 'supper Wed–Sun', readyEstimate: 'Dine-in experience', hasDelivery: false, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Wed–Sat 5–9 PM · Sun brunch & dinner' },
      { label: 'Cooking', value: 'Soul food from family recipes' },
      { label: 'Reservations', value: 'Suggested · walk-ins welcome' },
    ],
    highlightsLabel: 'Current supper menu',
    popularDishes: [{ name: 'BBQ Whole Shrimp', price: '$26' }, { name: 'Hominy Grits', price: '$39' }, { name: 'Jidori Chicken', price: '$45' }],
    menuHighlights: [
      { name: 'Boiled Peanuts', desc: 'Peanut miso and house spice', price: '$9', categories: ['Starters', 'Value'] },
      { name: 'BBQ Whole Shrimp', desc: 'Tomato gravy, brown butter, lemon and hot sauce', price: '$26', categories: ['Starters'] },
      { name: 'Hominy Grits', desc: 'Morels, asparagus, poached egg yolk and aged cheddar', price: '$39', categories: ['Mains'] },
      { name: 'Jidori Chicken', desc: 'Buttermilk-fried leg, roasted breast and deviled egg potato salad', price: '$45', categories: ['Mains'] },
    ],
    menuUrl: 'https://www.burdelloakland.com/menu?menu=dinner-menu-1',
    address: '4640 Telegraph Ave, Oakland, CA 94609',
    sourceUrl: 'https://www.burdelloakland.com/',
    primaryAction: { label: 'Menu', url: 'https://www.burdelloakland.com/menu?menu=dinner-menu-1' },
    reserveUrl: 'https://www.opentable.com/r/burdell-reservations-oakland?restref=1277533&lang=en-US&ot_source=Restaurant%20website',
    image: 'https://static.wixstatic.com/media/6211d7_29546f8bdf794b35aa3e95ba980191b0~mv2.jpg/v1/fill/w_720,h_720,al_c,q_85/6211d7_29546f8bdf794b35aa3e95ba980191b0~mv2.jpg',
    dishImage: 'https://static.wixstatic.com/media/6211d7_29546f8bdf794b35aa3e95ba980191b0~mv2.jpg/v1/fill/w_1200,h_800,al_c,q_85/6211d7_29546f8bdf794b35aa3e95ba980191b0~mv2.jpg',
  },
  // Official July 2026 menu, location and reservations checked Jul 19, 2026.
  mago: {
    id: 'mago', name: 'Mägo', cuisine: 'Colombian–Californian', price: '$$$', distanceLabel: '10 min ride',
    hours: 'Tue–Sat from 5 PM', hoursShort: 'dinner Tue–Sat', readyEstimate: 'Dine-in experience', hasDelivery: false, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Tue–Sat from 5 PM · bar happy hour 5–7 PM' },
      { label: 'Tasting menu', value: '$109 Tue–Thu · $149 Fri–Sat · vegetarian menu available' },
      { label: 'Cooking', value: 'Colombian spirit with Northern California ingredients' },
    ],
    highlightsLabel: 'July menu',
    popularDishes: [{ name: 'Summer tasting menu' }, { name: 'Arepa', price: '$8' }, { name: 'Local Ling Cod', price: '$26' }],
    menuHighlights: [
      { name: 'Summer tasting menu', desc: 'A nightly progression inspired by Colombia and Northern California', price: '$109–$149', categories: ['Mains'] },
      { name: 'Arepa', desc: 'Gruyère and dried alliums', price: '$8', categories: ['Starters', 'Value'] },
      { name: 'Local Ling Cod', desc: 'Yogurt adobo, banana leaf jus and fennel', price: '$26', categories: ['Mains'] },
      { name: 'Grilled Pork', desc: 'Cabbage en nogado and green walnut', price: '$32', categories: ['Mains'] },
    ],
    menuUrl: 'https://www.magorestaurant.com/menus/',
    address: '3762 Piedmont Ave, Oakland, CA 94611',
    sourceUrl: 'https://www.magorestaurant.com/',
    primaryAction: { label: 'Menu', url: 'https://www.magorestaurant.com/menus/' },
    reserveUrl: 'https://www.opentable.com/r/mago-reservations-oakland?restref=1150960&lang=en-US&ot_source=Restaurant%20website',
    image: 'https://images.getbento.com/accounts/d615d0323782ca5443f19298221179c7/media/images/833072024_Mago_Photos_081_1.jpg?w=1200&fit=crop&auto=compress,format&cs=origin',
    dishImage: 'https://images.getbento.com/accounts/d615d0323782ca5443f19298221179c7/media/images/833072024_Mago_Photos_081_1.jpg?w=1600&fit=crop&auto=compress,format&cs=origin',
  },
  // Official hours, menus, pickup and reservations checked Jul 19, 2026.
  parche: {
    id: 'parche', name: 'Parche', cuisine: 'Colombian', price: '$$$', distanceLabel: '11 min walk',
    hours: 'Lunch and dinner daily', hoursShort: 'till 10 PM Fri–Sat', readyEstimate: 'Lunch pickup available', hasDelivery: false, openLate: true,
    detailFacts: [
      { label: 'Hours', value: 'Daily till 9 PM · Fri–Sat till 10 PM' },
      { label: 'Happy hour', value: 'Tue–Thu 4–6 PM · Fri–Sun 3–5 PM at the bar and lounge' },
      { label: 'Service', value: 'Dine-in · lunch pickup · reservations · group dining' },
    ],
    highlightsLabel: 'Colombian essentials',
    popularDishes: [{ name: 'Ceviche' }, { name: 'Patacones' }, { name: 'Arepas' }],
    menuHighlights: [
      { name: 'Ceviche', desc: 'A rotating Colombian-inspired seafood preparation', categories: ['Starters'] },
      { name: 'Empanadas', desc: 'A shareable start from the current menu', categories: ['Starters', 'Value'] },
      { name: 'Patacones', desc: 'Crisp smashed plantains', categories: ['Starters', 'Value'] },
      { name: 'Arepas', desc: 'Colombian corn cakes with seasonal accompaniments', categories: ['Mains'] },
    ],
    menuUrl: 'https://www.parcheoak.com/menus',
    address: '2295 Broadway, Oakland, CA 94612',
    sourceUrl: 'https://www.parcheoak.com/',
    primaryAction: { label: 'Pickup', url: 'https://order.toasttab.com/online/parcheoak' },
    orderUrl: 'https://order.toasttab.com/online/parcheoak',
    reserveUrl: 'https://www.opentable.com/r/parche-reservations-oakland?restref=1259056&lang=en-US&ot_source=Restaurant%20website',
    image: 'https://images.squarespace-cdn.com/content/v1/639a779743274e6a90ebe0ce/1744843617042-85QMMY2EFGOACPQF25JK/Parche_October%2B2023_851A9362.jpg?format=1000w',
    dishImage: 'https://images.squarespace-cdn.com/content/v1/639a779743274e6a90ebe0ce/1744843617042-85QMMY2EFGOACPQF25JK/Parche_October%2B2023_851A9362.jpg?format=1500w',
  },
  // Official Temescal menu, hours and direct Toast ordering checked Jul 19, 2026.
  fob: {
    id: 'fob', name: 'FOB Kitchen', cuisine: 'Filipino', price: '$$', distanceLabel: '13 min ride',
    hours: 'Wed–Sun from 11 AM', hoursShort: 'till 10 PM Fri–Sat', readyEstimate: '20–30 min', hasDelivery: true, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Wed–Thu & Sun 11 AM–9 PM · Fri–Sat till 10 PM · Mon–Tue closed' },
      { label: 'Happy hour', value: 'Weekdays 3–6 PM' },
      { label: 'Service', value: 'Brunch · dinner · pickup · delivery' },
    ],
    highlightsLabel: 'Menu favorites',
    popularDishes: [{ name: 'Pork Adobo', price: '$20' }, { name: 'Sinigang Baboy', price: '$25' }, { name: 'Lechon Kawali', price: '$13' }],
    menuHighlights: [
      { name: 'Shanghai Lumpia', desc: 'Pork, carrot, water chestnut and sweet chili sauce', price: '$13', categories: ['Starters', 'Value'] },
      { name: 'Lechon Kawali', desc: 'Thrice-cooked pork belly, pickled red onion and Thai chili', price: '$13', categories: ['Starters'] },
      { name: 'Pork Adobo', desc: 'Palm vinegar, soy, garlic, annatto and coconut milk', price: '$20', categories: ['Mains'] },
      { name: 'Sinigang Baboy', desc: 'Tamarind-ginger soup with pork and vegetables', price: '$25', categories: ['Mains'] },
    ],
    menuUrl: 'https://www.fobkitchen.com/menu',
    address: '5179 Telegraph Ave, Oakland, CA 94609',
    sourceUrl: 'https://www.fobkitchen.com/fob-kitchen',
    primaryAction: { label: 'Order', url: 'https://order.toasttab.com/online/fob-kitchen' },
    orderUrl: 'https://order.toasttab.com/online/fob-kitchen',
    image: 'https://images.squarespace-cdn.com/content/v1/65246771ba8bec4890bb1169/b09bfa0d-91bc-4e84-a977-cc5198ec3b83/FOB_KITCHEN_092723_0005.jpg?format=1000w',
    dishImage: 'https://images.squarespace-cdn.com/content/v1/65246771ba8bec4890bb1169/b09bfa0d-91bc-4e84-a977-cc5198ec3b83/FOB_KITCHEN_092723_0005.jpg?format=1500w',
  },
  // Official Oakland menu, hours and direct ordering checked Jul 19, 2026.
  aburaya: {
    id: 'aburaya', name: 'Aburaya', cuisine: 'Japanese', price: '$', distanceLabel: '6 min walk',
    hours: 'Mon–Fri 11 AM–9 PM · Sat dinner', hoursShort: 'happy hour weekdays', readyEstimate: '15–25 min', hasDelivery: true, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Mon–Fri 11 AM–9 PM · Sat about 5–8:45 PM · Sun closed' },
      { label: 'Happy hour', value: '2–6 PM Mon, Tue, Thu & Fri · all day Wednesday' },
      { label: 'Cooking', value: 'Japanese fried chicken · gluten-free kitchen' },
    ],
    highlightsLabel: 'House favorites',
    popularDishes: [{ name: 'Four-piece Fried Chicken' }, { name: 'Oyako Don' }, { name: 'Deviled Avocado' }],
    menuHighlights: [
      { name: 'Four-piece Fried Chicken', desc: 'Karaage with house seasoning and sauce options', categories: ['Mains'] },
      { name: 'Oyako Don', desc: 'Chicken and egg rice bowl', categories: ['Mains'] },
      { name: 'Deviled Avocado', desc: 'Avocado stuffed with egg salad and umami seasoning', categories: ['Starters', 'Value'] },
      { name: 'Aburaya Tater Tots', desc: 'A weekday happy-hour favorite', price: '$5', categories: ['Starters', 'Value'] },
    ],
    menuUrl: 'https://aburayaoakland.com/menu',
    address: '362 17th St, Oakland, CA 94612',
    sourceUrl: 'https://aburayaoakland.com/',
    primaryAction: { label: 'Order', url: 'https://aburayaoakland.com/menu' },
    orderUrl: 'https://aburayaoakland.com/menu',
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Karaage.jpg?width=900',
    dishImage: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Karaage_001.jpg?width=1200',
  },
  // Official current Ristorante menu, hours and reservation page checked Jul 19, 2026.
  belotti: {
    id: 'belotti', name: 'Belotti Ristorante', cuisine: 'Italian', price: '$$$', distanceLabel: '14 min ride',
    hours: 'Mon–Sat 11 AM–10 PM', hoursShort: 'lunch + dinner Mon–Sat', readyEstimate: '20–35 min', hasDelivery: true, openLate: false,
    detailFacts: [
      { label: 'Hours', value: 'Ristorante Mon–Sat 11 AM–10 PM · Sunday closed' },
      { label: 'Cooking', value: 'Traditional Italian cooking with handmade pasta' },
      { label: 'Service', value: 'Dine-in · online pickup · reservations' },
    ],
    highlightsLabel: 'Handmade pasta',
    popularDishes: [{ name: 'Agnolotti di Lidia' }, { name: 'Tagliatelle al Cinghiale' }, { name: 'Gnocchi alla Bolognese' }],
    menuHighlights: [
      { name: 'Agnolotti di Lidia', desc: 'Piedmontese stuffed pasta with beef, pork, greens and reduction', categories: ['Mains'] },
      { name: 'Tagliatelle al Cinghiale', desc: 'Wild boar sugo, Pecorino Toscano and black pepper', categories: ['Mains'] },
      { name: 'Gnocchi alla Bolognese', desc: 'Potato gnocchi with six-meat Bolognese', categories: ['Mains'] },
      { name: 'Bruschetta', desc: 'Tomato, basil and buffalo mozzarella', categories: ['Starters', 'Value'] },
    ],
    menuUrl: 'https://belottirb.com/menu',
    address: '5403 College Ave, Oakland, CA 94618',
    sourceUrl: 'https://belottirb.com/',
    primaryAction: { label: 'Order', url: 'https://www.toasttab.com/belotti-bottega/v2/online-order' },
    orderUrl: 'https://www.toasttab.com/belotti-bottega/v2/online-order',
    reserveUrl: 'https://belottirb.com/reservation',
    image: 'https://images.squarespace-cdn.com/content/v1/567314efc647ad862c4cee9a/1455692780066-I9PI5JKXSEWOQNTY3QKK/IMG_1656.JPG?format=1000w',
    dishImage: 'https://images.squarespace-cdn.com/content/v1/567314efc647ad862c4cee9a/1455692780066-I9PI5JKXSEWOQNTY3QKK/IMG_1656.JPG?format=1500w',
  },
  // Official restaurant site and current direct Toast menu checked Jul 19, 2026.
  pizzaiolo: {
    id: 'pizzaiolo', name: 'Pizzaiolo', cuisine: 'Italian', price: '$$', distanceLabel: '13 min ride',
    hours: 'Dinner daily · later Fri–Sat', hoursShort: 'till 10 PM Fri–Sat', readyEstimate: '20–30 min', hasDelivery: true, openLate: true,
    detailFacts: [
      { label: 'Hours', value: 'Dinner 5–9 PM Sun–Thu · till 10 PM Fri–Sat' },
      { label: 'Cooking', value: 'Farm-driven pizza, pasta, salads and pantry items' },
      { label: 'Service', value: 'Dine-in · pickup · delivery' },
    ],
    highlightsLabel: 'Current Toast menu',
    popularDishes: [{ name: 'Margherita Pizza', price: '$24' }, { name: 'Pepperoni Pizza', price: '$29' }, { name: 'Potato + Mornay Pizza', price: '$28' }],
    menuHighlights: [
      { name: 'Margherita Pizza', price: '$24', categories: ['Mains'] },
      { name: 'Pepperoni Pizza', desc: 'Red onion, bell pepper and spicy honey', price: '$29', categories: ['Mains'] },
      { name: 'Potato + Mornay Pizza', desc: 'Green olives and Pecorino Romano', price: '$28', categories: ['Mains'] },
      { name: 'Broccolini', desc: 'Bagna cauda and toasted breadcrumbs', price: '$14', categories: ['Starters', 'Value'] },
    ],
    menuUrl: 'https://www.toasttab.com/local/order/pizzaiolo-oakland-5008-telegraph-avenue/r-c25b73cd-7cca-48b0-8620-4322d42fc939',
    address: '5008 Telegraph Ave, Oakland, CA 94609',
    sourceUrl: 'https://www.pizzaiolooakland.com/',
    primaryAction: { label: 'Order', url: 'https://www.toasttab.com/pizzaiolo-oakland-5008-telegraph-avenue/v3' },
    orderUrl: 'https://www.toasttab.com/pizzaiolo-oakland-5008-telegraph-avenue/v3',
    image: 'https://images.squarespace-cdn.com/content/v1/5e7176c217beb51183a7ba50/1597440364696-U30JOQM52G9VVPFNXM9V/Pizzaiolo+Oakland+Hand+Made+Pasta.jpg?format=1000w',
    dishImage: 'https://images.squarespace-cdn.com/content/v1/5e7176c217beb51183a7ba50/1597440364696-U30JOQM52G9VVPFNXM9V/Pizzaiolo+Oakland+Hand+Made+Pasta.jpg?format=1500w',
  },
};

type HubCuisineGroup = 'American' | 'Latin' | 'Asian' | 'Italian + Pizza';

interface HubRestaurantSeed {
  id: string;
  name: string;
  group: HubCuisineGroup;
  cuisine: string;
  price: '$' | '$$' | '$$$';
  distanceLabel: string;
  address: string;
  sourceUrl: string;
  reason: string;
  dishes: [string, string, string];
  searchTags: string[];
  hasDelivery?: boolean;
  openLate?: boolean;
}

// Representative editorial food photography. Detail pages always identify the restaurant
// separately and hand off menu/current-hours claims to the first-party source below.
const HUB_EDITORIAL_IMAGES = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=76',
  'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=900&q=76',
];

/**
 * Verified Oakland restaurants that extend the Food Hub without repeating Home. Exact hours,
 * prices and inventory stay on each official site so a fixture never pretends to be live data.
 */
const HUB_RESTAURANT_SEEDS: HubRestaurantSeed[] = [
  // American — California cooking, soul food, diners, burgers and barbecue.
  { id: 'pomet', name: 'Pomet', group: 'American', cuisine: 'Californian', price: '$$$', distanceLabel: '10 min ride', address: '4029 Piedmont Ave, Oakland, CA 94611', sourceUrl: 'https://www.pomet-oakland.com/', reason: 'Farm-driven California cooking', dishes: ['Seasonal tasting menu', 'Orchard fruit desserts', 'Market vegetables'], searchTags: ['farm to table', 'date night', 'tasting menu', 'seasonal'] },
  { id: 'woodtavern', name: 'Wood Tavern', group: 'American', cuisine: 'American brasserie', price: '$$$', distanceLabel: '14 min ride', address: '6317 College Ave, Oakland, CA 94618', sourceUrl: 'https://www.woodtavern.net/', reason: 'Rockridge brasserie institution', dishes: ['Pork chop', 'Pastrami sandwich', 'Ricotta gnocchi'], searchTags: ['brasserie', 'pork chop', 'sandwich', 'rockridge'] },
  { id: 'thewolf', name: 'The Wolf', group: 'American', cuisine: 'California–American', price: '$$$', distanceLabel: '10 min ride', address: '3853 Piedmont Ave, Oakland, CA 94611', sourceUrl: 'https://www.thewolfoakland.com/', reason: 'Seasonal Piedmont Avenue dining', dishes: ['Steak frites', 'Seasonal fish', 'House burger'], searchTags: ['date night', 'california', 'steak', 'piedmont avenue'] },
  { id: 'almondandoak', name: 'Almond and Oak', group: 'American', cuisine: 'New American', price: '$$$', distanceLabel: '9 min ride', address: '3311 Grand Ave, Oakland, CA 94610', sourceUrl: 'https://www.almondandoak.com/', reason: 'Oakland-grown, ingredient-led cooking', dishes: ['Buttermilk fried chicken', 'House hamburger', 'Shrimp and grits'], searchTags: ['brunch', 'fried chicken', 'burger', 'locally sourced'] },
  { id: 'bardo', name: 'Bardo Lounge & Supper Club', group: 'American', cuisine: 'American supper club', price: '$$$', distanceLabel: '10 min ride', address: '3343 Lakeshore Ave, Oakland, CA 94610', sourceUrl: 'https://www.bardooakland.com/', reason: 'Dinner-party plates + cocktails', dishes: ['Supper club burger', 'Seasonal shared plates', 'Classic cocktails'], searchTags: ['cocktails', 'date night', 'lounge', 'grand lake'], openLate: true },
  { id: 'brendas', name: 'Brenda’s Oakland', group: 'American', cuisine: 'Creole soul food', price: '$$', distanceLabel: '9 min ride', address: '4045 Broadway, Oakland, CA 94611', sourceUrl: 'https://brendasoakland.com/', reason: 'New Orleans comfort food all day', dishes: ['Beignets', 'Fried chicken', 'Shrimp and grits'], searchTags: ['breakfast', 'brunch', 'creole', 'catfish', 'biscuits'], hasDelivery: true },
  { id: 'loispie', name: 'Lois the Pie Queen', group: 'American', cuisine: 'Southern', price: '$$', distanceLabel: '14 min ride', address: '851 60th St, Oakland, CA 94608', sourceUrl: 'https://loisthepiequeen.com/', reason: 'Generations of Southern breakfast', dishes: ['Lemon icebox pie', 'Fried chicken', 'Pork chops and eggs'], searchTags: ['breakfast', 'pie', 'southern', 'soul food'] },
  { id: 'sequoia', name: 'Sequoia Diner', group: 'American', cuisine: 'California diner', price: '$$', distanceLabel: '14 min ride', address: '3719 MacArthur Blvd, Oakland, CA 94619', sourceUrl: 'https://www.sequoiadiner.com/', reason: 'Made-from-scratch Laurel brunch', dishes: ['Buttermilk pancakes', 'Eggs Benedict', 'Biscuits and gravy'], searchTags: ['breakfast', 'brunch', 'pancakes', 'laurel'] },
  { id: 'grandlake', name: 'Grand Lake Kitchen', group: 'American', cuisine: 'New American deli', price: '$$', distanceLabel: '12 min walk', address: '576 Grand Ave, Oakland, CA 94610', sourceUrl: 'https://www.grandlakekitchen.com/location/lake-merritt/', reason: 'All-day Oakland deli favorite', dishes: ['Savory French toast', 'Matzoh ball soup', 'Fried chicken sandwich'], searchTags: ['brunch', 'deli', 'sandwich', 'lake merritt'], hasDelivery: true },
  { id: 'lovelys', name: 'Lovely’s', group: 'American', cuisine: 'Smash burgers', price: '$', distanceLabel: '7 min walk', address: '2344 Webster St, Oakland, CA 94612', sourceUrl: 'https://www.lovelysburgers.com/oakland', reason: 'Smash burgers in a beer garden', dishes: ['Double cheeseburger', 'Crispy fries', 'Fish sandwich'], searchTags: ['burger', 'beer garden', 'casual', 'outdoor'], hasDelivery: true, openLate: true },
  { id: 'smokinwoods', name: 'Smokin Woods BBQ', group: 'American', cuisine: 'Barbecue', price: '$$', distanceLabel: '11 min ride', address: '4307 Telegraph Ave, Oakland, CA 94609', sourceUrl: 'https://smokinwoodsbbq.com/', reason: 'Oak-smoked meats + classic sides', dishes: ['Beef brisket', 'Pork ribs', 'Homemade beef links'], searchTags: ['barbecue', 'bbq', 'brisket', 'ribs', 'temescal'], hasDelivery: true },
  { id: 'trueburger', name: 'TrueBurger', group: 'American', cuisine: 'Burgers', price: '$', distanceLabel: '8 min walk', address: '146 Grand Ave, Oakland, CA 94612', sourceUrl: 'https://www.trueburgeroakland.com/', reason: 'Straightforward Oakland burgers', dishes: ['TrueBurger', 'Cheeseburger', 'Milkshake'], searchTags: ['burger', 'fries', 'shake', 'quick bite'], hasDelivery: true },
  { id: 'lakechalet', name: 'Lake Chalet', group: 'American', cuisine: 'Californian seafood', price: '$$$', distanceLabel: '12 min walk', address: '1520 Lakeside Dr, Oakland, CA 94612', sourceUrl: 'https://www.thelakechalet.com/', reason: 'Lake Merritt views + seafood', dishes: ['Oysters', 'Fresh fish', 'Chalet burger'], searchTags: ['seafood', 'patio', 'waterfront', 'lake merritt', 'happy hour'], openLate: true },

  // Latin — Mexican, Colombian, Salvadoran, Dominican and pan-Latin Oakland kitchens.
  { id: 'cholita', name: 'Cholita Linda', group: 'Latin', cuisine: 'Latin American', price: '$$', distanceLabel: '12 min ride', address: '4923 Telegraph Ave, Oakland, CA 94609', sourceUrl: 'https://www.cholitalinda.com/', reason: 'Bright tacos + Cuban sandwiches', dishes: ['Baja fish tacos', 'Cuban sandwich', 'Carnitas tacos'], searchTags: ['tacos', 'cuban', 'fish', 'temescal'], hasDelivery: true },
  { id: 'nido', name: 'NIDO’s Backyard', group: 'Latin', cuisine: 'Mexican', price: '$$', distanceLabel: '9 min ride', address: '104 Oak St, Oakland, CA 94607', sourceUrl: 'https://www.nidooakland.com/', reason: 'Open-air Mexican gathering spot', dishes: ['Carnitas tacos', 'Guacamole', 'Mushroom quesadilla'], searchTags: ['patio', 'outdoor', 'tacos', 'jack london'], hasDelivery: true, openLate: true },
  { id: 'calavera', name: 'Calavera', group: 'Latin', cuisine: 'Mexican', price: '$$$', distanceLabel: '8 min walk', address: '2337 Broadway, Oakland, CA 94612', sourceUrl: 'https://www.opentable.com/r/calavera-oakland', reason: 'Modern Mexican plates + mezcal', dishes: ['Mole', 'Ceviche', 'Tacos'], searchTags: ['mezcal', 'mole', 'uptown', 'cocktails'] },
  { id: 'agave', name: 'Agave Uptown', group: 'Latin', cuisine: 'Oaxacan', price: '$$$', distanceLabel: '6 min walk', address: '2135 Franklin St, Oakland, CA 94612', sourceUrl: 'https://www.agaveuptown.com/', reason: 'Oaxacan cooking + deep mezcal list', dishes: ['Mole negro', 'Tlayuda', 'Ceviche'], searchTags: ['oaxaca', 'mezcal', 'mole', 'uptown'] },
  { id: 'dona', name: 'Doña', group: 'Latin', cuisine: 'Mexican', price: '$$', distanceLabel: '10 min ride', address: '3770 Piedmont Ave, Oakland, CA 94611', sourceUrl: 'https://www.donaoakland.com/', reason: 'California produce, regional classics', dishes: ['Pozole', 'Enchiladas', 'Breakfast tacos'], searchTags: ['brunch', 'patio', 'tacos', 'happy hour'], hasDelivery: true },
  { id: 'lasguerreras', name: 'Las Guerreras', group: 'Latin', cuisine: 'Guerrerense Mexican', price: '$$', distanceLabel: '6 min walk', address: '907 Washington St, Oakland, CA 94607', sourceUrl: 'https://order.toasttab.com/online/la-guerreras-kitchen-907-washington', reason: 'Seafood-rich cooking from Guerrero', dishes: ['Pescado a la talla', 'Coconut ceviche', 'Tamales'], searchTags: ['mexican seafood', 'old oakland', 'ceviche', 'guerrero'], hasDelivery: true },
  { id: 'tacososcar', name: 'Tacos Oscar', group: 'Latin', cuisine: 'Mexican', price: '$$', distanceLabel: '11 min ride', address: '420 40th St, Oakland, CA 94609', sourceUrl: 'https://www.tacososcar.com/', reason: 'Inventive tacos, concise menu', dishes: ['Seasonal vegetable taco', 'Braised meat taco', 'Tostada'], searchTags: ['tacos', 'tostada', 'vegetarian', 'temescal'] },
  { id: 'ricorico', name: 'Rico Rico Taco', group: 'Latin', cuisine: 'Mexican', price: '$', distanceLabel: '10 min ride', address: '3205 Lakeshore Ave, Oakland, CA 94610', sourceUrl: 'https://www.ricoricotaco.com/', reason: 'Lakeshore tacos + burritos', dishes: ['Al pastor tacos', 'Burrito', 'Quesabirria'], searchTags: ['tacos', 'burrito', 'birria', 'lakeshore'], hasDelivery: true },
  { id: 'sobremesa', name: 'Sobre Mesa', group: 'Latin', cuisine: 'Afro-Latin', price: '$$$', distanceLabel: '5 min walk', address: '1618 Franklin St, Oakland, CA 94612', sourceUrl: 'https://sobremesaoak.com/', reason: 'Afro-Latin bites + cocktails', dishes: ['Empanadas', 'Plantain dishes', 'Rum cocktails'], searchTags: ['cocktails', 'lounge', 'empanadas', 'downtown'], openLate: true },
  { id: 'alamar', name: 'alaMar Dominican Kitchen', group: 'Latin', cuisine: 'Dominican', price: '$$$', distanceLabel: '9 min walk', address: '100 Grand Ave, Oakland, CA 94612', sourceUrl: 'https://alamaroakland.com/', reason: 'Contemporary Dominican cooking', dishes: ['Sancocho', 'Whole fried red snapper', 'Dominican rice bowl'], searchTags: ['dominican', 'seafood', 'plantains', 'uptown'], hasDelivery: true },
  { id: 'loscantaros', name: 'Los Cantaros', group: 'Latin', cuisine: 'Mexican', price: '$', distanceLabel: '10 min walk', address: '336 Grand Ave, Oakland, CA 94610', sourceUrl: 'https://www.loscantarosgrandave.com/', reason: 'Dependable Grand Avenue taqueria', dishes: ['Torta de pierna', 'Super burrito', 'Enchiladas'], searchTags: ['tacos', 'burrito', 'torta', 'grand lake'], hasDelivery: true },
  { id: 'obelisco', name: 'Obelisco', group: 'Latin', cuisine: 'Salvadoran', price: '$$', distanceLabel: '10 min ride', address: 'Oakland, CA 94610', sourceUrl: 'https://www.obeliscorestaurant.com/home', reason: 'Salvadoran comfort food + pupusas', dishes: ['Pupusas', 'Yuca frita', 'Salvadoran tamal'], searchTags: ['salvadoran', 'pupusa', 'plantain', 'family cooking'] },
  { id: 'molcajete', name: 'Molcajete Cocina Mexicana', group: 'Latin', cuisine: 'Mexican', price: '$$', distanceLabel: '5 min walk', address: '1743 Webster St, Oakland, CA 94612', sourceUrl: 'https://molcajetecocinamexicana.com/menu/', reason: 'Downtown Mexican comfort food', dishes: ['Molcajete burrito bowl', 'Chilaquiles torta', 'California burrito'], searchTags: ['burrito', 'chilaquiles', 'molcajete', 'downtown'], hasDelivery: true },

  // Asian — Filipino, Japanese, Lao, Cambodian, Vietnamese, Chinese, Korean and Burmese.
  { id: 'vientian', name: 'Vientian Cafe', group: 'Asian', cuisine: 'Lao', price: '$$', distanceLabel: '14 min ride', address: '3801 Allendale Ave, Oakland, CA 94619', sourceUrl: 'https://www.vientiancafe.com/', reason: 'Soulful Lao cooking in East Oakland', dishes: ['Lao sausage', 'Papaya salad', 'Red curry'], searchTags: ['lao', 'thai', 'vietnamese', 'noodles', 'curry'], hasDelivery: true },
  { id: 'phnompenh', name: 'Phnom Penh House', group: 'Asian', cuisine: 'Cambodian', price: '$$', distanceLabel: '14 min ride', address: '3912 MacArthur Blvd, Oakland, CA 94619', sourceUrl: 'https://phnompenhhouse.com/', reason: 'Long-running Cambodian family kitchen', dishes: ['Fish amok', 'Khmer noodles', 'Prahok ktiss'], searchTags: ['cambodian', 'khmer', 'laurel', 'family style'] },
  { id: 'camhuong', name: 'Cam Huong', group: 'Asian', cuisine: 'Vietnamese', price: '$', distanceLabel: '5 min walk', address: '920 Webster St, Oakland, CA 94607', sourceUrl: 'https://camhuongbakery.com/index.html', reason: 'Fast, classic Vietnamese counter', dishes: ['Bánh mì', 'Bún bò Huế', 'Rice plate'], searchTags: ['vietnamese', 'sandwich', 'noodle soup', 'chinatown'], hasDelivery: true },
  { id: 'shandong', name: 'Shandong', group: 'Asian', cuisine: 'Chinese', price: '$$', distanceLabel: '5 min walk', address: '328 10th St, Oakland, CA 94607', sourceUrl: 'https://www.shandongoakland.com/', reason: 'Handmade noodles + dumplings', dishes: ['Handmade sesame noodles', 'Pork dumplings', 'Shandong beef'], searchTags: ['chinese', 'dumplings', 'noodles', 'chinatown'], hasDelivery: true },
  { id: 'pyeongchang', name: 'Pyeong Chang Tofu House', group: 'Asian', cuisine: 'Korean', price: '$$', distanceLabel: '12 min ride', address: '4701 Telegraph Ave, Oakland, CA 94609', sourceUrl: 'https://pctofu.com/en-CA', reason: 'Steaming sundubu + Korean comfort', dishes: ['Original tofu soup', 'Seafood pancake', 'Bibimbap'], searchTags: ['korean', 'sundubu', 'tofu', 'temescal'], hasDelivery: true },
  { id: 'mensho', name: 'MENSHO Oakland', group: 'Asian', cuisine: 'Japanese ramen', price: '$$', distanceLabel: '10 min ride', address: '4250 Piedmont Ave, Oakland, CA 94611', sourceUrl: 'https://mensho.com/location/mensho-oakland/', reason: 'Boundary-pushing ramen bowls', dishes: ['Smoked tori paitan', 'Spicy lamb miso ramen', 'Vegan tantanmen'], searchTags: ['ramen', 'japanese', 'vegan', 'noodles', 'piedmont avenue'] },
  { id: 'marufuku', name: 'Marufuku Ramen', group: 'Asian', cuisine: 'Japanese ramen', price: '$$', distanceLabel: '12 min ride', address: '4828 Telegraph Ave, Oakland, CA 94609', sourceUrl: 'https://www.marufukuramen.com/oakland', reason: 'Hakata-style ramen in Temescal', dishes: ['Hakata tonkotsu ramen', 'Chicken paitan', 'Gyoza'], searchTags: ['ramen', 'japanese', 'noodles', 'temescal'], hasDelivery: true },
  { id: 'mujiri', name: 'Mujiri', group: 'Asian', cuisine: 'Japanese sushi', price: '$$', distanceLabel: '14 min ride', address: '6501 San Pablo Ave, Oakland, CA 94608', sourceUrl: 'https://mujiri-oakland.com/', reason: 'Focused sushi, updated daily', dishes: ['Nigiri combo', 'Sashimi combo', 'Daily maki'], searchTags: ['sushi', 'japanese', 'nigiri', 'sashimi'], hasDelivery: true },
  { id: 'tenieast', name: 'Teni East Kitchen', group: 'Asian', cuisine: 'Burmese', price: '$$', distanceLabel: '10 min ride', address: '4015 Broadway, Oakland, CA 94611', sourceUrl: 'https://tenieastkitchen.com/', reason: 'Polished Burmese cooking', dishes: ['Tea leaf kale salad', 'Coconut vegetable curry', 'Crispy whole fish'], searchTags: ['burmese', 'curry', 'tea leaf salad', 'vegan'], hasDelivery: true },
  { id: 'burmastar', name: 'Burma Superstar', group: 'Asian', cuisine: 'Burmese', price: '$$', distanceLabel: '12 min ride', address: '4721 Telegraph Ave, Oakland, CA 94609', sourceUrl: 'https://www.burmasuperstar.com/heritage', reason: 'Beloved Burmese share plates', dishes: ['Tea leaf salad', 'Rainbow salad', 'Coconut rice'], searchTags: ['burmese', 'salad', 'curry', 'temescal'], hasDelivery: true },
  { id: 'daughterthai', name: 'Daughter Thai Kitchen', group: 'Asian', cuisine: 'Thai', price: '$$$', distanceLabel: '8 min walk', address: '6118 Medau Pl, Oakland, CA 94611', sourceUrl: 'https://daughterthai.com/', reason: 'Regional Thai dishes, polished room', dishes: ['Khao soi', 'Lemongrass chicken', 'Thai curry'], searchTags: ['thai', 'curry', 'noodles', 'montclair'] },
  { id: 'noka', name: 'Noka Ramen', group: 'Asian', cuisine: 'Japanese ramen', price: '$$', distanceLabel: '9 min ride', address: '90 Franklin St, Oakland, CA 94607', sourceUrl: 'https://www.nokaramen.com/', reason: 'Colorful bowls near Jack London', dishes: ['Tonkotsu ramen', 'Spicy miso ramen', 'Vegan ramen'], searchTags: ['ramen', 'japanese', 'noodles', 'jack london'], hasDelivery: true },
  { id: 'saucy', name: 'Saucy Oakland', group: 'Asian', cuisine: 'Pan-Asian', price: '$$$', distanceLabel: '5 min walk', address: '468 8th St, Oakland, CA 94607', sourceUrl: 'https://www.saucyoakland.com/', reason: 'Pan-Asian plates + sake', dishes: ['Garlic noodles', 'Basil chicken', 'Pork belly steamed bao'], searchTags: ['sake', 'garlic noodles', 'bao', 'old oakland'], hasDelivery: true, openLate: true },

  // Italian + Pizza — pasta rooms, wood-fired pies, slices and worker-owned bakeries.
  { id: 'a16', name: 'A16 Rockridge', group: 'Italian + Pizza', cuisine: 'Italian', price: '$$$', distanceLabel: '14 min ride', address: '5356 College Ave, Oakland, CA 94618', sourceUrl: 'https://www.a16pizza.com/oakland', reason: 'Campanian cooking + wood-fired pizza', dishes: ['Margherita pizza', 'Burrata', 'Salsiccia pizza'], searchTags: ['italian', 'pizza', 'wood fired', 'rockridge'] },
  { id: 'marzano', name: 'Marzano', group: 'Italian + Pizza', cuisine: 'Italian', price: '$$$', distanceLabel: '14 min ride', address: '4214 Park Blvd, Oakland, CA 94602', sourceUrl: 'https://www.marzanorestaurant.com/home/dinner-malnb', reason: 'Glenview wood-fired neighborhood spot', dishes: ['Wood-fired pizza', 'Meatballs', 'Seasonal pasta'], searchTags: ['italian', 'pizza', 'pasta', 'glenview'] },
  { id: 'bellanico', name: 'Bellanico', group: 'Italian + Pizza', cuisine: 'Italian', price: '$$$', distanceLabel: '14 min ride', address: '4238 Park Blvd, Oakland, CA 94602', sourceUrl: 'https://bellanico.net/NEW/menus.html', reason: 'Seasonal Italian in Glenview', dishes: ['Casoncelli', 'House gnocchi', 'Seasonal risotto'], searchTags: ['italian', 'pasta', 'wine', 'glenview'] },
  { id: 'mama', name: 'MAMA Oakland', group: 'Italian + Pizza', cuisine: 'Italian', price: '$$$', distanceLabel: '10 min walk', address: '388 Grand Ave, Oakland, CA 94610', sourceUrl: 'https://mama-oakland.com/menu', reason: 'Compact prix-fixe Italian menu', dishes: ['Mama’s sugo', 'Seasonal handmade pasta', 'Cannoli'], searchTags: ['italian', 'prix fixe', 'pasta', 'grand lake'] },
  { id: 'nickspizza', name: 'Nick’s Pizza', group: 'Italian + Pizza', cuisine: 'Sourdough pizza', price: '$$', distanceLabel: '14 min ride', address: '6400 Shattuck Ave, Oakland, CA 94609', sourceUrl: 'https://www.toasttab.com/nicks-pizza-6400-shattuck-ave', reason: 'Worker-owned sourdough pizza', dishes: ['Sourdough pizza', 'Mushroom pizza', 'Morning buns'], searchTags: ['pizza', 'bakery', 'sourdough', 'worker owned'], hasDelivery: true },
  { id: 'arizmendi', name: 'Arizmendi Bakery', group: 'Italian + Pizza', cuisine: 'Vegetarian pizza', price: '$', distanceLabel: '10 min ride', address: '3265 Lakeshore Ave, Oakland, CA 94610', sourceUrl: 'https://arizmendibakery.com/', reason: 'Worker-owned pizza + pastry counter', dishes: ['Daily vegetarian pizza', 'Cheese rolls', 'Scones'], searchTags: ['pizza', 'bakery', 'vegetarian', 'pastry', 'worker owned'] },
  { id: 'thestarpizza', name: 'The Star on Grand', group: 'Italian + Pizza', cuisine: 'Deep-dish pizza', price: '$$', distanceLabel: '10 min ride', address: '3425 Grand Ave, Oakland, CA 94610', sourceUrl: 'https://thestarpizza.com/', reason: 'Deep dish by Lake Merritt', dishes: ['Classic deep dish', 'Thin-crust pizza', 'House salad'], searchTags: ['pizza', 'deep dish', 'grand lake'], hasDelivery: true },
  { id: 'forge', name: 'Forge Rockridge', group: 'Italian + Pizza', cuisine: 'Wood-fired pizza', price: '$$', distanceLabel: '14 min ride', address: 'Rockridge, Oakland, CA 94618', sourceUrl: 'https://forgerockridge.com/', reason: 'Sourdough pies + group-friendly room', dishes: ['Forge pepperoni pizza', 'Margherita pizza', 'Crispy cheese curds'], searchTags: ['pizza', 'wood fired', 'sourdough', 'rockridge'], hasDelivery: true },
  { id: 'graffiti', name: 'Graffiti Pizza', group: 'Italian + Pizza', cuisine: 'New York pizza', price: '$', distanceLabel: '5 min walk', address: '818 Washington St, Oakland, CA 94607', sourceUrl: 'https://graffitipizza.com/', reason: 'Old Oakland slices, open later', dishes: ['New York cheese slice', 'Pepperoni pizza', 'Garlic knots'], searchTags: ['pizza', 'slice', 'new york', 'old oakland'], hasDelivery: true, openLate: true },
  { id: 'squarepie', name: 'Square Pie Guys', group: 'Italian + Pizza', cuisine: 'Detroit-style pizza', price: '$$', distanceLabel: '5 min walk', address: '499 Dr. Huey P. Newton Way, Oakland, CA 94607', sourceUrl: 'https://www.squarepieguys.com/menu', reason: 'Crisp-edged Detroit-style pies', dishes: ['Pepperoni square pie', 'Lemon pepper pie', 'Mush-o-roni'], searchTags: ['pizza', 'detroit style', 'old oakland'], hasDelivery: true, openLate: true },
  { id: 'sliver', name: 'SLIVER Pizzeria', group: 'Italian + Pizza', cuisine: 'Vegetarian pizza', price: '$', distanceLabel: '5 min walk', address: '2300 Broadway, Oakland, CA 94612', sourceUrl: 'https://sliverpizzeria.com/', reason: 'Vegetarian slices + green sauce', dishes: ['Pizza of the day', 'Green sauce', 'Seasonal salad'], searchTags: ['pizza', 'vegetarian', 'vegan', 'uptown'], hasDelivery: true },
  { id: 'dimondslice', name: 'Dimond Slice Pizza', group: 'Italian + Pizza', cuisine: 'Vegetarian pizza', price: '$', distanceLabel: '14 min ride', address: '2208 MacArthur Blvd, Oakland, CA 94602', sourceUrl: 'https://www.dimondpizza.com/menu', reason: 'Neighborhood vegetarian slices', dishes: ['Pizza of the day', 'Vegan pizza', 'Green salsa'], searchTags: ['pizza', 'vegetarian', 'vegan', 'dimond'], hasDelivery: true },
  { id: 'spinningdough', name: 'Spinning Dough', group: 'Italian + Pizza', cuisine: 'Wood-fired pizza', price: '$$', distanceLabel: '12 min ride', address: '2935 Market St, Oakland, CA 94608', sourceUrl: 'https://www.spinningdough.com/', reason: 'West Oakland neighborhood pizzeria', dishes: ['Wood-fired pizza', 'Chicken wings', 'Cannoli'], searchTags: ['pizza', 'wood fired', 'west oakland'], hasDelivery: true },
];

function restaurantFromHubSeed(seed: HubRestaurantSeed, index: number): Restaurant {
  const image = HUB_EDITORIAL_IMAGES[index % HUB_EDITORIAL_IMAGES.length];
  return {
    id: seed.id,
    name: seed.name,
    cuisine: seed.cuisine,
    price: seed.price,
    distanceLabel: seed.distanceLabel,
    image,
    dishImage: image,
    hours: 'See official site for today’s hours',
    hoursShort: 'confirm today’s hours',
    readyEstimate: 'Check official menu',
    detailFacts: [
      { label: 'Why it’s here', value: seed.reason },
      { label: 'Area', value: seed.address.split(', Oakland')[0] },
      { label: 'Current details', value: 'Menu and hours link to the restaurant’s official site' },
    ],
    highlightsLabel: 'Known for',
    popularDishes: seed.dishes.map((name) => ({ name })),
    menuHighlights: seed.dishes.map((name, dishIndex) => ({
      name,
      categories: dishIndex === 2 ? ['Value'] : ['Mains'],
    })),
    menuUrl: seed.sourceUrl,
    hasDelivery: seed.hasDelivery ?? false,
    openLate: seed.openLate ?? false,
    address: seed.address,
    sourceUrl: seed.sourceUrl,
    primaryAction: { label: 'Official site', url: seed.sourceUrl },
    orderUrl: seed.hasDelivery ? seed.sourceUrl : undefined,
    searchTags: [seed.group, seed.reason, ...seed.searchTags],
  };
}

Object.assign(
  RESTAURANTS,
  Object.fromEntries(HUB_RESTAURANT_SEEDS.map((seed, index) => [seed.id, restaurantFromHubSeed(seed, index)])),
);

/** Home "Nearby eats" tile roster, in display order. */
export const NEARBY_EATS_IDS = ['cookfarmer', 'itani', 'mua', 'farmhouse'];

// Events live in ./events.ts so daily refreshes touch one focused file.
export { EVENTS } from './events';
export type { EventCategory, ScoperEvent } from './events';

const OAKLAND_TIME_ZONE = 'America/Los_Angeles';

function oaklandDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OAKLAND_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function eventStart(event: ScoperEvent): Date | null {
  if (!event.startsAt) return null;
  const value = new Date(event.startsAt);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function isEventToday(event: ScoperEvent, now = new Date()): boolean {
  const start = eventStart(event);
  return Boolean(start && oaklandDateKey(start) === oaklandDateKey(now));
}

export function isCurrentEvent(event: ScoperEvent, now = new Date()): boolean {
  const start = eventStart(event);
  return Boolean(start && oaklandDateKey(start) >= oaklandDateKey(now));
}

export function currentEventListings(now = new Date()): ScoperEvent[] {
  return Object.values(EVENTS)
    .filter((event) => isCurrentEvent(event, now))
    .sort((a, b) => (eventStart(a)?.getTime() ?? 0) - (eventStart(b)?.getTime() ?? 0));
}

/** Earliest current event from each venue, so Home never becomes one calendar repeated. */
export function homeEventPicks(now = new Date()): ScoperEvent[] {
  const current = currentEventListings(now);
  const seenVenues = new Set<string>();
  const picks: ScoperEvent[] = [];

  for (const event of current) {
    const venueIdentity = event.venueId ?? event.venue.trim().toLowerCase();
    if (seenVenues.has(venueIdentity)) continue;
    seenVenues.add(venueIdentity);
    picks.push(event);
    if (picks.length === 4) break;
  }

  return picks;
}

export function eventDayGroupLabel(event: ScoperEvent, now = new Date()): string {
  const start = eventStart(event);
  if (!start) return 'Past';
  if (isEventToday(event, now)) return 'Tonight';
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (oaklandDateKey(start) === oaklandDateKey(tomorrow)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: OAKLAND_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(start);
}

/** Current Oakland-day events, earliest showtime first. */
export function tonightEvents(now = new Date()): ScoperEvent[] {
  return currentEventListings(now).filter((event) => isEventToday(event, now));
}

export interface UpcomingEventSection {
  id: string;
  title: string;
  note: string;
  events: ScoperEvent[];
}

/** Discover's Upcoming view, split into themed shelves. Each event appears exactly once. */
export function upcomingEventSections(now = new Date()): UpcomingEventSection[] {
  const remaining = currentEventListings(now);
  const take = (predicate: (event: ScoperEvent) => boolean): ScoperEvent[] => {
    const picked = remaining.filter(predicate);
    for (const event of picked) remaining.splice(remaining.indexOf(event), 1);
    return picked;
  };

  return [
    { id: 'tonight', title: 'Tonight', note: 'Doors open today', events: take((event) => isEventToday(event, now)) },
    { id: 'free', title: 'Free nights', note: 'No-cover official programs', events: take((event) => /free/i.test(event.priceLabel)) },
    { id: 'outdoor', title: 'Open air', note: 'Outdoor stages + campuses', events: take((event) => event.cats.includes('Outdoor')) },
    { id: 'theaters', title: 'The grand theaters', note: 'Fox + Paramount stages', events: take((event) => event.venueId === 'fox' || event.venueId === 'paramount') },
    { id: 'more', title: 'Also on the calendar', note: 'Official listings', events: remaining },
  ].filter((section) => section.events.length > 0);
}

/** "7:30 PM" / "7 PM" / "11 AM" → minutes since midnight, for sorting within a day. */
export function parseTimeToMinutes(time: string): number {
  const m = time.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
  if (!m) return 0;
  let hour = parseInt(m[1], 10) % 12;
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + minute;
}

export interface Venue {
  id: string;
  name: string;
  sub1: string;
  sub2: string;
  detailMeta: string;
  address: string;
  detailFacts: { label: string; value: string }[];
  sourceUrl: string;
  image: string;
}

export const VENUES: Record<string, Venue> = {
  yoshis: {
    id: 'yoshis',
    name: 'Yoshi’s',
    sub1: 'Live music venue & Japanese restaurant · est. 1972',
    sub2: '510 Embarcadero W, Jack London Square · ride 6 min · ~$9',
    detailMeta: 'Live music · Japanese dining · 6 min ride',
    address: '510 Embarcadero W, Oakland, CA 94607',
    detailFacts: [
      { label: 'Venue', value: '310-seat music club · founded 1972' },
      { label: 'Shows', value: 'All ages unless noted · one-item minimum during shows' },
      { label: 'Box office', value: 'Daily from 4:30 PM' },
    ],
    sourceUrl: 'https://yoshis.com/events/',
    image: 'https://yoshis.com/userfiles/kcfinder/images/yoshis-venue-2022_web%281%29.jpg',
  },
  fox: {
    id: 'fox',
    name: 'Fox Theater',
    sub1: 'Restored 1928 movie palace · cap. 2,800',
    sub2: '1807 Telegraph Ave · 6 min walk',
    detailMeta: 'Concert hall · 2,800 capacity · 6 min walk',
    address: '1807 Telegraph Ave, Oakland, CA 94612',
    detailFacts: [
      { label: 'Venue', value: 'Restored 1928 movie palace · capacity up to 2,800' },
      { label: 'Shows', value: 'Most are all ages · every guest needs a ticket' },
      { label: 'Box office', value: 'Opens 30 min before doors' },
    ],
    sourceUrl: 'https://thefoxoakland.com/calendar/',
    image: 'https://thefoxoakland.com/wp-content/uploads/sites/5/2016/12/marquee-shot-1024x683.jpg',
  },
  paramount: {
    id: 'paramount', name: 'Paramount Theatre',
    sub1: 'Art Deco landmark · movies, concerts & performing arts', sub2: '2025 Broadway · 7 min walk',
    detailMeta: 'Art Deco theatre · performing arts · 7 min walk',
    address: '2025 Broadway, Oakland, CA 94612',
    detailFacts: [
      { label: 'Venue', value: '1931 Art Deco landmark · authentically restored in 1973' },
      { label: 'Box office', value: 'Fri 12–5 PM · opens 30 min before doors' },
      { label: 'Accessibility', value: 'Accessible seating · assistive listening · no elevator' },
    ],
    sourceUrl: 'https://www.paramountoakland.org/events',
    image: 'https://www.paramountoakland.org/assets/img/2017-2-4-Balc-Auditorium-HKam-416e12d650.jpg',
  },
  elis: {
    id: 'elis', name: 'Eli’s Mile High Club',
    sub1: 'West Oakland blues bar · weekly live series · 21+', sub2: '3629 Martin Luther King Jr Way · ride 9 min',
    detailMeta: 'Blues bar · 21+ · 9 min ride',
    address: '3629 Martin Luther King Jr Way, Oakland, CA 94609',
    detailFacts: [
      { label: 'Venue', value: '21+ live music, food and drinks' },
      { label: 'Hours', value: 'Mon & Thu 4 PM–1 AM · Fri & Sat 4 PM–2 AM' },
      { label: 'Blue Mondays', value: '7–11 PM · this week: Big Harp George · RSVP' },
    ],
    sourceUrl: 'https://www.elismilehighclub.com/events',
    image: 'https://static.wixstatic.com/media/4a4730_1e39c5d76a8548069c266f3742eb1afb~mv2.jpg/v1/fit/w_763,h_953,q_90,enc_avif,quality_auto/4a4730_1e39c5d76a8548069c266f3742eb1afb~mv2.jpg',
  },
};

export interface Crawl {
  id: string;
  name: string;
  meta: string;
  desc: string;
  stops: { name: string; note: string }[];
  routeUrl: string;
}

export const CRAWLS: Record<string, Crawl> = {
  oldoakland: {
    id: 'oldoakland', name: 'Oakland institutions crawl', meta: '4 stops · cross-town · rides recommended',
    desc: 'A north-to-south route through four distinct Oakland bar landmarks, ending on the Jack London Square waterfront.',
    stops: [
      { name: 'The Alley', note: '3325 Grand Ave · piano bar' },
      { name: 'Cafe Van Kleef', note: '1621 Telegraph Ave · Uptown' },
      { name: 'The Arbor', note: '460 8th St · Sante Adairius taproom' },
      { name: 'Heinold’s First & Last Chance', note: '48 Webster St · operating since 1884' },
    ],
    routeUrl: 'https://www.google.com/maps/dir/?api=1&origin=The+Alley+Oakland&destination=Heinold%27s+First+and+Last+Chance&waypoints=Cafe+Van+Kleef%7C460+8th+St+Oakland&travelmode=walking',
  },
  uptown: {
    id: 'uptown', name: 'Uptown cocktails & hi-fi', meta: '3 stops · under 1 mi · walkable',
    desc: 'Three active Uptown bars in a practical walking order, with cocktails, vinyl, and a relaxed late-night finish.',
    stops: [
      { name: 'Bar Shiru', note: '1611 Telegraph Ave · hi-fi listening bar' },
      { name: 'Agave Uptown', note: '2135 Franklin St · Oaxacan restaurant and mezcal bar' },
      { name: 'Night Heron', note: '1780 Telegraph Ave · cocktails across from the Fox' },
    ],
    routeUrl: 'https://www.google.com/maps/dir/?api=1&origin=Bar+Shiru+Oakland&destination=Night+Heron+Oakland&waypoints=Agave+Uptown&travelmode=walking',
  },
  downtown: {
    id: 'downtown', name: 'Downtown cocktail hop', meta: '3 stops · 0.8 mi · walkable',
    desc: 'A compact downtown route from a neighborhood cocktail bar to an Afro-Latin lounge and a playful late-night finish.',
    stops: [
      { name: 'Little Bird', note: '435 13th St · neighborhood cocktails · till 2 AM' },
      { name: 'Sobre Mesa', note: '1618 Franklin St · Afro-Latin cocktail lounge' },
      { name: 'Penelope', note: '555 12th St · cocktails and snacks' },
    ],
    routeUrl: 'https://www.google.com/maps/dir/?api=1&origin=Little+Bird+Bar+Oakland&destination=Penelope+Oakland&waypoints=Sobre+Mesa+Oakland&travelmode=walking',
  },
};

export interface NightlifeSpot {
  id: string;
  name: string;
  kind: string;
  hours: string;
  address: string;
  /** One verified paragraph for the detail page — no invented color. */
  desc: string;
  /** Native photo from the spot's own site; absent renders the striped placeholder. */
  image?: string;
  url: string;
}

/** Discover's "Night out" shelf: bars, pubs and clubs with official-page handoffs. */
export const NIGHTLIFE_SPOTS: NightlifeSpot[] = [
  {
    id: 'hello-stranger', name: 'Hello Stranger', kind: 'DJ bar', hours: 'Nights posted on the official page',
    address: '1724 Broadway, Oakland, CA 94612',
    desc: 'Bar and DJ room on Broadway. Nights, DJs, and hours are posted on the official page.',
    url: 'https://www.hellostrangeroakland.com/',
  },
  {
    id: 'crybaby', name: 'Crybaby', kind: 'Club + live music', hours: 'Event calendar online',
    address: '1928 Telegraph Ave, Oakland, CA 94612',
    desc: 'Club and live-music room across from the Fox Theater, in the former Uptown Nightclub space. Shows are listed on the official calendar.',
    image: 'https://crybaby.live/wp-content/uploads/2022/07/Crybaby_2022_For_Web-9_v2.1-1024x683.jpg',
    url: 'https://crybaby.live/',
  },
  {
    id: 'athletic-club', name: 'The Athletic Club Oakland', kind: 'Sports bar', hours: 'Hours on the official site',
    address: '59 Grand Ave, Oakland, CA',
    desc: 'Sports bar and social club two blocks from Lake Merritt, back open under new ownership since spring 2026.',
    image: 'https://images.squarespace-cdn.com/content/v1/6761322acdb56456fb03e59d/a8cf3ec9-ca8b-456f-8029-81fad6f41dbe/DSC07662-1-2.jpg?format=800w',
    url: 'https://www.oaklandathleticclub.com/',
  },
  {
    // Replaced The Trappist (closed; its old domain now serves spam) — checked Jul 20, 2026.
    id: 'arbor', name: 'The Arbor', kind: 'Craft beer taproom', hours: 'Daily · Fri–Sat till 11 PM',
    address: '460 8th St, Oakland, CA 94607',
    desc: 'Sante Adairius Rustic Ales taproom in the Belgian-style Old Oakland room that housed The Trappist. Dog- and kid-friendly, with a patio.',
    url: 'https://rusticales.com/oakland-arbor/',
  },
  {
    id: 'drakes-dealership', name: 'Drake’s Dealership', kind: 'Beer garden', hours: 'Hours on the official site',
    address: '2325 Broadway, Oakland, CA 94612',
    desc: 'Drake’s Brewing beer garden in a former car dealership, with a firepit patio and wood-fired pizza.',
    url: 'https://drinkdrakes.com/visit/dealership/',
  },
  {
    // makewesting.com serves an invalid certificate (checked Jul 20, 2026) — hand off to Maps.
    id: 'make-westing', name: 'Make Westing', kind: 'Cocktails + bocce', hours: 'Hours on the Maps listing',
    address: '1741 Telegraph Ave, Oakland, CA 94612',
    desc: 'Big Uptown cocktail bar with indoor bocce courts.',
    url: 'https://www.google.com/maps/search/?api=1&query=Make%20Westing%20Oakland',
  },
  {
    id: 'little-bird', name: 'Little Bird', kind: 'Neighborhood cocktail bar', hours: 'Daily · 4 PM–2 AM',
    address: '435 13th St, Oakland, CA 94612',
    desc: 'Neighborhood cocktail bar downtown, open until 2 AM every night.',
    image: 'https://images.squarespace-cdn.com/content/v1/681fa9fa8166e940653d6b47/6052d3cf-f48e-42d3-9489-628075555b3d/LBgroupdrinkshot2.jpg?format=1000w',
    url: 'https://www.littlebirdbar.com/',
  },
  {
    id: 'bar-shiru', name: 'Bar Shiru', kind: 'Hi-fi listening bar · 21+', hours: 'Fri–Sat till 1 AM',
    address: '1611 Telegraph Ave, Oakland, CA 94612',
    desc: 'Hi-fi listening bar built around a vinyl library and rotating selectors. 21+.',
    image: 'https://images.squarespace-cdn.com/content/v1/5abbe7a1f2e6b18135abbf19/d5e40445-f570-4fe2-b16f-407e9dd401c4/Action_02_JiggerDrip.jpg?format=1000w',
    url: 'https://www.barshiru.com/',
  },
  {
    id: 'night-heron', name: 'Night Heron', kind: 'Cocktails, music & local art', hours: 'Fri–Sat till 2 AM',
    address: '1780 Telegraph Ave, Oakland, CA 94612',
    desc: 'Cocktails, music, and local art across from the Fox Theater.',
    image: 'https://www.nightheronoakland.com/uploads/1/1/9/5/119579727/night-heron-337_orig.jpg',
    url: 'https://www.nightheronoakland.com/',
  },
  {
    id: 'penelope', name: 'Penelope', kind: 'Cocktail bar & snackateria', hours: 'Mon–Thu till 11 PM',
    address: '555 12th St, Oakland, CA 94612',
    desc: 'Cocktail bar and snackateria in City Center.',
    image: 'https://images.squarespace-cdn.com/content/v1/61adab8405db3f794c46c8f9/1639104369089-2CWU2V2LRMBIMEHS3MG4/Cocktails_Brooklyn%2Bour.jpg?format=1000w',
    url: 'https://penelopeoakland.com/',
  },
];

// Hand-picked restaurant buckets — still the roster behind FAV_POOL (the
// official-ordering-links directory) even though the food hub's own chip UI
// now browses by real category/cuisine instead of these broad groups.
export const CUISINES = ['All', 'American', 'Latin', 'Asian', 'Italian + Pizza'] as const;

// Factual badges (verified Jul 2026) — no invented promos
export const DEALS: Record<string, string> = {
  farmhouse: 'DINNER TILL 8:30 PM',
  cookfarmer: 'OYSTER HOUR TUE–FRI',
  itani: 'HAPPY HOUR 3–5 & 8–CLOSE',
  sinaloa: 'TILL 1 AM',
  gogi: 'TILL 11:30 PM FRI–SAT',
  colonial: 'OPEN 24 HOURS',
  mua: 'BAR MENU ALL NIGHT TUE–THU & SUN',
  jos: 'LUNCH & DINNER WED–SUN',
  bombera: 'DINNER MON & WED–SAT',
  shootingstar: 'TILL MIDNIGHT DAILY',
  commis: 'TEN-COURSE TASTING MENU',
  burdell: 'SUPPER WED–SUN',
  mago: '15% OFF BAR FOOD 5–7 PM',
  parche: 'HAPPY HOUR TUE–SUN',
  fob: 'HAPPY HOUR WEEKDAYS 3–6 PM',
  aburaya: 'HAPPY HOUR MON–FRI',
  belotti: 'HANDMADE PASTA MON–SAT',
  pizzaiolo: 'DINNER DAILY',
};

export const CUISINE_MATCH: Record<string, string[]> = {
  American: ['commis', 'burdell', ...HUB_RESTAURANT_SEEDS.filter((spot) => spot.group === 'American').map((spot) => spot.id)],
  Latin: ['mago', 'parche', ...HUB_RESTAURANT_SEEDS.filter((spot) => spot.group === 'Latin').map((spot) => spot.id)],
  Asian: ['fob', 'aburaya', ...HUB_RESTAURANT_SEEDS.filter((spot) => spot.group === 'Asian').map((spot) => spot.id)],
  'Italian + Pizza': ['belotti', 'pizzaiolo', ...HUB_RESTAURANT_SEEDS.filter((spot) => spot.group === 'Italian + Pizza').map((spot) => spot.id)],
};

export interface HomeActionLink {
  label: string;
  iconD: string;
  /** Boolean filter enabled after a reset, before opening the directory. */
  flag?: 'delivery' | 'openLate' | 'reserve';
  sort?: string;
  /** Search seeded into the directory (/featured?q=…). */
  query?: string;
  /** Route override for pills that open a dedicated surface. */
  href?: string;
}

/** Action-first Home launchers — each answers an intent, not a cuisine. */
export const HOME_ACTION_LINKS: HomeActionLink[] = [
  { label: 'Coffee near me', iconD: 'M4 8h13v5a4 4 0 0 1 -4 4h-5a4 4 0 0 1 -4 -4z M17 9h1a2.5 2.5 0 0 1 0 5h-1 M8 4v2 M11 4v2 M14 4v2', query: 'coffee', sort: 'Nearest' },
  { label: 'Fast delivery', iconD: 'M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11', flag: 'delivery', sort: 'Nearest' },
  { label: 'Happy hours', iconD: 'M8 21h8 M12 15v6 M5 4h14l-7 8z', query: 'happy hour' },
  { label: 'Open late', iconD: 'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z', flag: 'openLate' },
  { label: 'Reserve tonight', iconD: 'M6 3v3 M18 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z', flag: 'reserve' },
];

// The hour-aware ordering of these lives in lib/daypart.ts (homeActionLinks) —
// this file stays dependency-free apart from the event catalog so the release
// audit can evaluate it in isolation (see scripts/audit-app.mjs).

/** Hub-only roster. It intentionally excludes every restaurant surfaced directly on Home. */
export const FAV_POOL = CUISINES
  .filter((cuisine) => cuisine !== 'All')
  .flatMap((cuisine) => CUISINE_MATCH[cuisine]);

export interface FoodHubPick {
  id: string;
  reason: string;
}

export interface FoodHubSection {
  id: string;
  title: string;
  note: string;
  picks: FoodHubPick[];
}

export const FOOD_HUB_REASON_BY_ID: Record<string, string> = Object.fromEntries(
  [
    ['commis', 'Ten-course Oakland tasting menu'],
    ['burdell', 'Soul food through a California lens'],
    ['mago', 'Colombian spirit, seasonal tasting menu'],
    ['parche', 'Lively Colombian plates for sharing'],
    ['fob', 'Filipino comfort food + cocktails'],
    ['aburaya', 'Japanese fried chicken, punk-rock energy'],
    ['belotti', 'Handmade pasta in Rockridge'],
    ['pizzaiolo', 'Farm-driven pizza in Temescal'],
    ...HUB_RESTAURANT_SEEDS.map((spot) => [spot.id, spot.reason]),
  ],
);

/**
 * The All view is a discovery surface, not a directory: short cross-cutting
 * themes (the cuisine pills already give exhaustive lists). 3–4 picks each.
 */
export const FOOD_HUB_SECTIONS: FoodHubSection[] = [
  {
    id: 'date-night',
    title: 'Date night, locked',
    note: 'Reserve-worthy rooms',
    picks: [
      { id: 'commis', reason: 'Ten-course Oakland tasting menu' },
      { id: 'pomet', reason: 'Farm-driven seasonal menu on Piedmont Ave' },
      { id: 'mama', reason: 'Prix-fixe handmade pasta by Grand Lake' },
      { id: 'calavera', reason: 'Modern Mexican + a deep mezcal list' },
    ],
  },
  {
    id: 'brunch',
    title: 'Weekend brunch circuit',
    note: 'Morning-to-noon moves',
    picks: [
      { id: 'brendas', reason: 'Beignets and Creole comfort all day' },
      { id: 'sequoia', reason: 'Scratch pancakes in the Laurel' },
      { id: 'loispie', reason: 'Generations of Southern breakfast' },
      { id: 'dona', reason: 'Breakfast tacos + chilaquiles on the patio' },
    ],
  },
  {
    id: 'patios',
    title: 'Golden-hour patios',
    note: 'Outdoor tables + views',
    picks: [
      { id: 'lakechalet', reason: 'Oysters over Lake Merritt at sunset' },
      { id: 'nido', reason: 'Open-air backyard near Jack London' },
      { id: 'lovelys', reason: 'Smash burgers in a beer garden' },
      { id: 'cookfarmer', reason: 'Garden seating + Tue–Fri oyster hour' },
    ],
  },
  {
    id: 'quick-cheap',
    title: 'Fast + under $20',
    note: 'Counter classics',
    picks: [
      { id: 'trueburger', reason: 'Burger, fries and a shake, no fuss' },
      { id: 'camhuong', reason: 'Chinatown bánh mì counter' },
      { id: 'graffiti', reason: 'New York slices in Old Oakland' },
      { id: 'ricorico', reason: 'Quesabirria + burritos on Lakeshore' },
    ],
  },
  {
    id: 'late',
    title: 'Still serving late',
    note: 'Kitchens past 10 PM',
    picks: [
      { id: 'gogi', reason: 'Korean BBQ till 11:30 Fri–Sat' },
      { id: 'bardo', reason: 'Supper-club plates + classic cocktails' },
      { id: 'sobremesa', reason: 'Afro-Latin bites + rum cocktails downtown' },
      { id: 'saucy', reason: 'Garlic noodles + sake, open late' },
    ],
  },
  {
    id: 'noodles',
    title: 'Noodle obsessions',
    note: 'Ramen, hand-pulled + khao soi',
    picks: [
      { id: 'mensho', reason: 'Boundary-pushing tori paitan bowls' },
      { id: 'shandong', reason: 'Hand-pulled noodles in Chinatown' },
      { id: 'noka', reason: 'Colorful ramen near Jack London Square' },
      { id: 'daughterthai', reason: 'Khao soi worth the Montclair trip' },
    ],
  },
  {
    id: 'institutions',
    title: 'Oakland institutions',
    note: 'Beloved for good reason',
    picks: [
      { id: 'woodtavern', reason: 'The Rockridge brasserie standby' },
      { id: 'burmastar', reason: 'Tea leaf salad that built a following' },
      { id: 'phnompenh', reason: 'Long-running Cambodian family kitchen' },
      { id: 'arizmendi', reason: 'Worker-owned pizza + pastry counter' },
    ],
  },
];

// Featured spots for the "All" cuisine state
export const DEFAULT_FAVS = ['commis', 'mago', 'fob', 'belotti'];

// ── Filters (Home's Filter sheet) ───────────────────────────────────────────

export interface RestaurantFilters {
  price: string | null;
  openLate: boolean;
  delivery: boolean;
  reserve: boolean;
  sort: string; // 'Best match' | 'Nearest' | 'Lowest price'
}

function distanceMinutes(label: string): number {
  const walk = label.match(/(\d+)\s*min\s*walk/);
  if (walk) return parseInt(walk[1], 10);
  const ride = label.match(/(\d+)\s*min\s*ride/);
  if (ride) return parseInt(ride[1], 10) + 20; // rides read as "further" than a walk for sorting
  const mi = label.match(/([\d.]+)\s*mi/);
  if (mi) return parseFloat(mi[1]) * 20; // rough walk-minutes-per-mile proxy
  return 999;
}

/** Hub-only search used by the cuisine rail and Filter sheet together. */
export function applyRestaurantFilters(restaurants: Restaurant[], filters: RestaurantFilters): Restaurant[] {
  let list = restaurants.filter((r) => {
    if (filters.price && r.price !== filters.price) return false;
    if (filters.openLate && !r.openLate) return false;
    if (filters.delivery && !r.hasDelivery) return false;
    if (filters.reserve && !r.reserveUrl) return false;
    return true;
  });

  if (filters.sort === 'Nearest') list = [...list].sort((a, b) => distanceMinutes(a.distanceLabel) - distanceMinutes(b.distanceLabel));
  else if (filters.sort === 'Lowest price') {
    const rank: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3 };
    list = [...list].sort((a, b) => (rank[a.price] ?? 99) - (rank[b.price] ?? 99));
  }

  return list;
}

function normalizeRestaurantSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, ' ')
    .trim();
}

function restaurantSearchFields(restaurant: Restaurant): { name: string; dishes: string; full: string } {
  const dishes = restaurant.menuHighlights
    .map((item) => `${item.name} ${item.desc ?? ''} ${item.categories.join(' ')}`)
    .join(' ');
  const facts = restaurant.detailFacts.map((fact) => `${fact.label} ${fact.value}`).join(' ');
  const full = [
    restaurant.name,
    restaurant.cuisine,
    restaurant.address,
    restaurant.hours ?? '',
    restaurant.hoursShort ?? '',
    FOOD_HUB_REASON_BY_ID[restaurant.id] ?? '',
    DEALS[restaurant.id] ?? '',
    dishes,
    restaurant.popularDishes.map((item) => item.name).join(' '),
    facts,
    ...(restaurant.searchTags ?? []),
  ].join(' ');
  return {
    name: normalizeRestaurantSearch(restaurant.name),
    dishes: normalizeRestaurantSearch(dishes),
    full: normalizeRestaurantSearch(full),
  };
}

/** Token-based catalog search: words may match across name, cuisine, area, reasons and menu items. */
export function searchRestaurants(query: string, restaurants = Object.values(RESTAURANTS)): Restaurant[] {
  const normalized = normalizeRestaurantSearch(query);
  if (!normalized) return restaurants;
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return restaurants
    .map((restaurant, index) => {
      const fields = restaurantSearchFields(restaurant);
      if (!tokens.every((token) => fields.full.includes(token))) return null;
      let score = 0;
      if (fields.name === normalized) score += 120;
      else if (fields.name.startsWith(normalized)) score += 80;
      else if (fields.name.includes(normalized)) score += 60;
      if (fields.dishes.includes(normalized)) score += 45;
      score += tokens.filter((token) => fields.name.includes(token)).length * 12;
      score += tokens.filter((token) => fields.dishes.includes(token)).length * 8;
      return { restaurant, score, index };
    })
    .filter((match): match is { restaurant: Restaurant; score: number; index: number } => Boolean(match))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((match) => match.restaurant);
}

/** Global search over the complete catalog (not just the hub roster), preserving active filters. */
export function searchFoodHub(query: string, filters: RestaurantFilters): Restaurant[] {
  const eligible = applyRestaurantFilters(Object.values(RESTAURANTS), filters);
  if (filters.sort !== 'Best match') {
    const matches = new Set(searchRestaurants(query, eligible).map((restaurant) => restaurant.id));
    return eligible.filter((restaurant) => matches.has(restaurant.id));
  }
  return searchRestaurants(query, eligible);
}

// ── Menu items (detail screen's Menu tab) ───────────────────────────────────

/**
 * Thumbnail for a menu row. Only the establishment's own photo (item.image) is
 * shown — never a generic stand-in. Missing photos render the neutral striped
 * placeholder until a native image is sourced from the official site.
 */
export function menuItemImage(item: RestaurantMenuItem): string | undefined {
  return item.image;
}

/** Explain a menu-item match directly in its result row instead of returning an opaque place. */
export function restaurantSearchCue(restaurant: Restaurant, query: string): string {
  const tokens = normalizeRestaurantSearch(query).split(/\s+/).filter(Boolean);
  const menuMatch = restaurant.menuHighlights.find((item) => {
    const text = normalizeRestaurantSearch(`${item.name} ${item.desc ?? ''} ${item.categories.join(' ')}`);
    return tokens.every((token) => text.includes(token));
  });
  if (menuMatch) return `Menu match · ${menuMatch.name}`;
  const tagMatch = (restaurant.searchTags ?? []).find((tag) => {
    const text = normalizeRestaurantSearch(tag);
    return tokens.every((token) => text.includes(token));
  });
  if (tagMatch) return `Matches · ${tagMatch}`;
  return FOOD_HUB_REASON_BY_ID[restaurant.id] ?? `${restaurant.cuisine} in Oakland`;
}

export type CuratedCollectionItem =
  | { type: 'restaurant'; id: string; note?: string }
  | { type: 'event'; id: string; note?: string };

export interface CuratedCollection {
  id:
    | 'late-night'
    | 'omca-fridays'
    | 'yoshis-week'
    | 'outdoor-tables'
    | 'before-the-show'
    | 'slice-order'
    | 'morning-plates';
  title: string;
  shortTitle: string;
  eyebrow: string;
  subtitle: string;
  description: string;
  coverImage: string;
  items: CuratedCollectionItem[];
  venueId?: string;
  sourceNote: string;
}

/** Collection-level context sits between Home cards and individual restaurant/event details. */
export const CURATED_COLLECTIONS: Record<CuratedCollection['id'], CuratedCollection> = {
  'late-night': {
    id: 'late-night',
    title: 'Late night, still hungry',
    shortTitle: 'Late-night food',
    eyebrow: 'LATE KITCHENS',
    subtitle: '3 verified stops · midnight to 24 hours',
    description: 'Three different ways to eat after the show.',
    coverImage: RESTAURANTS.sinaloa.image,
    items: [
      { type: 'restaurant', id: 'sinaloa', note: 'Tacos and burritos until 1 AM' },
      { type: 'restaurant', id: 'shootingstar', note: 'Hong Kong cafe menu until 11:30 PM' },
      { type: 'restaurant', id: 'colonial', note: 'A 24-hour donut and coffee counter' },
    ],
    sourceNote: 'Late hours and service checked against each restaurant’s official site.',
  },
  'omca-fridays': {
    id: 'omca-fridays',
    title: 'Friday Nights at OMCA',
    shortTitle: 'OMCA Fridays',
    eyebrow: 'SUMMER AT OMCA',
    subtitle: 'Outdoor music · food · community',
    description: 'Friday nights on the museum campus.',
    coverImage: EVENTS.seijiOda.image,
    items: [
      { type: 'event', id: 'seijiOda' },
      { type: 'event', id: 'ashleyMehta' },
      { type: 'event', id: 'sabrinaShauna' },
    ],
    sourceNote: 'Dates and program details checked against OMCA’s official July and August calendars.',
  },
  'yoshis-week': {
    id: 'yoshis-week',
    title: 'A week of music at Yoshi’s',
    shortTitle: 'Yoshi’s this week',
    eyebrow: 'CURRENT SHOWS',
    subtitle: 'Soul, jazz and guitar · official tickets',
    description: 'A different sound every night this week.',
    coverImage: EVENTS.melbaMoore.image,
    items: [
      { type: 'event', id: 'melbaMoore' },
      { type: 'event', id: 'robertCray' },
      { type: 'event', id: 'stylistics' },
      { type: 'event', id: 'keikoMatsui' },
      { type: 'event', id: 'roseRoyce' },
    ],
    venueId: 'yoshis',
    sourceNote: 'Showtimes and ticket ranges checked against Yoshi’s official calendar.',
  },

  'outdoor-tables': {
    id: 'outdoor-tables',
    title: 'Tables in the open air',
    shortTitle: 'Outdoor tables',
    eyebrow: 'OUTDOORS',
    subtitle: '5 places · patios and a beer garden',
    description: 'Eat outside while it is still warm enough.',
    coverImage: RESTAURANTS.cookfarmer.image,
    items: [
      { type: 'restaurant', id: 'cookfarmer', note: 'Garden seating at Swan’s Market' },
      { type: 'restaurant', id: 'lakechalet', note: 'Lake Merritt views from the patio' },
      { type: 'restaurant', id: 'nido', note: 'Open-air room near Jack London' },
      { type: 'restaurant', id: 'dona', note: 'Patio seating, California produce' },
      { type: 'restaurant', id: 'lovelys', note: 'Smash burgers in a beer garden' },
    ],
    sourceNote: 'Outdoor seating taken from each restaurant’s own description.',
  },
  'before-the-show': {
    id: 'before-the-show',
    title: 'Dinner before the show',
    shortTitle: 'Before the show',
    eyebrow: 'UPTOWN',
    subtitle: '4 places · walk to the theater',
    description: 'Uptown kitchens near the Fox and the Paramount.',
    coverImage: RESTAURANTS.calavera.image,
    items: [
      { type: 'restaurant', id: 'calavera', note: 'Modern Mexican plates and mezcal' },
      { type: 'restaurant', id: 'agave', note: 'Oaxacan cooking, deep mezcal list' },
      { type: 'restaurant', id: 'alamar', note: 'Contemporary Dominican cooking' },
      { type: 'restaurant', id: 'sliver', note: 'Vegetarian slices, quick before curtain' },
    ],
    venueId: 'fox',
    sourceNote: 'Uptown locations taken from each restaurant’s listed address.',
  },
  'slice-order': {
    id: 'slice-order',
    title: 'Five kinds of pizza',
    shortTitle: 'Pizza, five ways',
    eyebrow: 'FOOD',
    subtitle: '5 places · sourdough to Detroit',
    description: 'One city, five arguments about crust.',
    coverImage: RESTAURANTS.nickspizza.image,
    items: [
      { type: 'restaurant', id: 'nickspizza', note: 'Worker-owned sourdough' },
      { type: 'restaurant', id: 'squarepie', note: 'Crisp-edged Detroit style' },
      { type: 'restaurant', id: 'graffiti', note: 'New York slices, open later' },
      { type: 'restaurant', id: 'forge', note: 'Wood-fired, room for a group' },
      { type: 'restaurant', id: 'arizmendi', note: 'Worker-owned, vegetarian' },
    ],
    sourceNote: 'Styles taken from each pizzeria’s own menu.',
  },
  'morning-plates': {
    id: 'morning-plates',
    title: 'Worth getting up for',
    shortTitle: 'Breakfast picks',
    eyebrow: 'BREAKFAST',
    subtitle: '4 places · breakfast and brunch',
    description: 'Breakfast that justifies the alarm.',
    coverImage: RESTAURANTS.brendas.image,
    items: [
      { type: 'restaurant', id: 'brendas', note: 'New Orleans comfort food all day' },
      { type: 'restaurant', id: 'loispie', note: 'Generations of Southern breakfast' },
      { type: 'restaurant', id: 'sequoia', note: 'Made-from-scratch Laurel brunch' },
      { type: 'restaurant', id: 'grandlake', note: 'All-day deli by the lake' },
    ],
    sourceNote: 'Breakfast and brunch service taken from each restaurant’s own menu.',
  },
};

export const CURATED_COLLECTION_ORDER: CuratedCollection['id'][] = [
  'late-night',
  'outdoor-tables',
  'before-the-show',
  'slice-order',
  'morning-plates',
  'omca-fridays',
  'yoshis-week',
];

/** Prevent a dated collection from retaining an event after its Oakland calendar day passes. */
export function activeCollectionItems(collection: CuratedCollection, now = new Date()): CuratedCollectionItem[] {
  return collection.items.filter((item) => item.type === 'restaurant' || isCurrentEvent(EVENTS[item.id], now));
}

