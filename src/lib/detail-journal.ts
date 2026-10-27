import type { ScoperEvent, Restaurant } from '@/lib/data';
import { restaurantForPlace } from '@/lib/catalog-identity';
import type { DetailContent, DetailMenuItem } from '@/lib/detail-content';

export type JournalFact = { label: string; value: string; glyph?: string; fullValue?: string };
export type JournalMenuItem = DetailMenuItem;
export type MenuJournalListing = {id:string;name:string;sourceUrl:string;menuUrl:string;menuHighlights:readonly JournalMenuItem[];image?:string;primaryAction:{label:string;url:string};orderUrl?:string;reserveUrl?:string};

export function menuListingForPlace(place:{id:string;name:string;address?:string|null;city?:string;detailContent?:DetailContent},restaurants:readonly Restaurant[],city:string):MenuJournalListing|undefined {
  const curated=restaurantForPlace(place,restaurants,place.city||city);
  if(curated)return curated;
  const content=place.detailContent,menu=content?.menu,document=content?.menuDocuments?.[0];if(!menu&&!document)return;
  const url=menu?.url||document!.url;
  return {id:place.id,name:place.name,sourceUrl:content!.sourceUrl,menuUrl:url,menuHighlights:menu?.items||[],primaryAction:{label:menu?.sourceLabel||'View menu',url}};
}
export type JournalSpecial = { title: string; label: string; description: string; url: string };
export type JournalArtist = { name: string; role?: string; image?: string; description?: string; url?: string };

const canonical = (url: string) => url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
const bonoboSource = 'https://thefoxoakland.com/events/bonobo-261114';

/** The selected render used the restaurant's lunch-combo menu. Keep those
 * prices attached to that menu, not to the dinner menu or live inventory. */
export function restaurantJournalMenu(restaurant: MenuJournalListing, content?:DetailContent): {
  items: readonly JournalMenuItem[]; note?: string; specials: readonly JournalSpecial[];
} {
  if(content?.menu?.items.length)return {items:content.menu.items,note:content.menu.note,specials:content.offers||[]};
  if (restaurant.id === 'shootingstar' && canonical(restaurant.sourceUrl) === 'https://www.shootingstarhkcafe.com') {
    return {
      note: 'Lunch-combo prices · check the official menu for availability.',
      items: [
        { name: 'Black pepper short ribs', price: '$17.95', categories: ['Mains'], note: 'From the lunch-combo menu, daily 11 AM–8 PM.', image: 'https://static.wixstatic.com/media/1acdb3_4b97d76fda88424c91582ac52a01aefc~mv2.jpg' },
        { name: 'Wonton noodle soup', price: '$13.95', categories: ['Noodles'], note: 'From the lunch-combo menu, daily 11 AM–8 PM.', image: 'https://static.wixstatic.com/media/1acdb3_cf926e19c0c34b25a5d7a0aa9d7fa211~mv2.jpg' },
        { name: 'Hainan chicken & rice', price: '$16.95', categories: ['Mains'], note: 'From the lunch-combo menu, daily 11 AM–8 PM.', image: 'https://static.wixstatic.com/media/1acdb3_397ef5fee46a4716a700b3f5d88dc309~mv2.jpg' },
        { name: 'Curry chicken', price: '$15.50', categories: ['Mains'], note: 'From the lunch-combo menu, daily 11 AM–8 PM.', image: 'https://static.wixstatic.com/media/1acdb3_1becf3cf3c064f92a7a5cc33e251cc98~mv2.jpg' },
      ],
      specials: [{ title: 'Make it a lunch combo', label: 'Daily · 11 AM–8 PM', description: 'Rice or spaghetti + hot drink. Soup & salad for dine-in.', url: restaurant.orderUrl || restaurant.menuUrl }],
    };
  }
  return { items: restaurant.menuHighlights, specials: [] };
}

export function journalMenuCategories(items: readonly JournalMenuItem[]): string[] {
  return ['All', ...new Set(items.flatMap(item => [...item.categories]))];
}

export function filterJournalMenu(items: readonly JournalMenuItem[], category: string,query=''): readonly JournalMenuItem[] {
  const selected=category==='All'?items:items.filter(item=>item.categories.includes(category));
  const normalize=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=normalize(query).trim().split(/\s+/).filter(Boolean);
  return words.length?selected.filter(item=>words.every(word=>normalize([item.name,item.desc,...item.categories].filter(Boolean).join(' ')).includes(word))):selected;
}

/** All dishes appear once, while their complete category filters remain useful. */
export function journalMenuGroups(items:readonly JournalMenuItem[]):{title:string;items:JournalMenuItem[]}[] {
  const groups=new Map<string,JournalMenuItem[]>();
  for(const item of items){const title=item.categories[0]||'Menu';const group=groups.get(title)||[];group.push(item);groups.set(title,group);}
  return [...groups].map(([title,items])=>({title,items}));
}

export function journalMenuSource(content:DetailContent|undefined,fallbackUrl:string):{label:string;url:string;pricing?:string} {
  const menu=content?.menu;
  const label=menu?.sourceLabel||({official:'Official menu',ubereats:'Uber Eats',doordash:'DoorDash'}[menu?.sourceKind||'official']);
  return {label,url:menu?.url||content?.menuDocuments?.[0]?.url||fallbackUrl,
    pricing:menu?.pricingContext==='delivery'?'Delivery prices · may differ at the venue':undefined};
}

/** Inline groups may wrap naturally. Full source values remain in About &
 * visit and in Vee's context, even when their compact label is ellipsized. */
export function compactJournalFacts(facts: readonly JournalFact[]): JournalFact[] {
  return facts.map(fact => {
    const location=/address|location|destination|venue/i.test(fact.label),hours=/hours/i.test(fact.label),service=/service/i.test(fact.label);
    const value=location?fact.value.split(/[,·]/)[0].trim():hours?fact.value.replace(/^(?:open\s+)?daily\s*[·:]?\s*/i,'').replace(/\bmidnight\b/gi,'12 AM')
      :service?fact.value.split(/\s*[·•]\s*/).slice(0,2).join(' / '):fact.value;
    return {...fact,value,fullValue:fact.value,glyph:fact.glyph||(location?'pin':hours?'clock':service?'food':'compass')};
  });
}

/** Enrichment belongs to an exact official listing. Another show at this
 * venue never inherits its support act, age restriction or upgrade. */
export function eventJournalDetails(event: ScoperEvent): {
  subtitle?: string; ageLabel?: string; artists: JournalArtist[];
  upgrade?: JournalSpecial; policies?: { text: string; url: string };
} {
  const content=event.detailContent;
  if(content?.artists?.length)return {subtitle:content.subtitle,ageLabel:content.ageLabel,artists:content.artists,upgrade:content.offers?.[0]};
  if (canonical(event.sourceUrl) === bonoboSource) return {
    subtitle: 'Distance in Static · Live tour', ageLabel: 'All ages',
    artists: [
      { name: 'Bonobo', role: 'Headliner', image: event.image, description: 'A full live band, guest vocals and immersive visuals.', url: 'https://bonobomusic.com/' },
      { name: 'Sofia Kourtesis', role: 'Support', image: 'https://sofiakourtesis.com/media/bg3.jpg', url: 'https://sofiakourtesis.com/' },
    ],
    upgrade: { title: 'The Telegraph Room', label: 'Optional upgrade', description: 'A lounge before, during & after. Additional fee; subject to availability. A show ticket is also required.', url: 'https://thefoxoakland.com/venue-info/the-telegraph-room/' },
    policies: { text: 'All ages. The venue is cashless. Check official policies for bags, accessible seating and show updates.', url: 'https://thefoxoakland.com/faq/' },
  };
  const names = [...new Set((event.lineup&&!/^lineup is (on|available)/i.test(event.lineup)?event.lineup:event.name).split(/\s*[·•]\s*/).map(name => name.trim()).filter(Boolean))];
  return {
    ageLabel: content?.ageLabel||event.vibeTags?.find(tag => /^(all ages|\d{2}\+)$/i.test(tag)),
    artists: names.map(name => ({ name, image: name.toLowerCase() === event.name.toLowerCase() ? event.image : undefined, url: event.sourceUrl })),
  };
}

export function eventJournalFacts(event: ScoperEvent): JournalFact[] {
  const details = eventJournalDetails(event);
  const doors = event.date.match(/doors\s*:?\s*([0-9:]{1,5}\s*(?:AM|PM))/i)?.[1];
  return [
    { label: 'When', value: [event.date.split('·')[0].trim(), event.time, details.ageLabel].filter(Boolean).join(' · '), glyph: 'calendar' },
    { label: 'Venue', value: [doors ? 'Doors ' + doors : null, event.venue].filter(Boolean).join(' · '), glyph: doors ? 'clock' : 'pin' },
  ];
}
