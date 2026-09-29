// Wayvee events — the daily-refresh surface (see DATA.md).
// This file is regenerated as listings change: add new events with a startsAt
// ISO timestamp, advance recurring series to their next occurrence, and DELETE
// past entries rather than archiving them. Every entry keeps sourceUrl +
// verifiedLabel so the audit trail survives each refresh.
// Last refreshed: Aug 1, 2026.

export type EventCategory = 'Tonight' | 'Upcoming' | 'Live music' | 'Outdoor' | 'Movies';

/** Where a listing came from. 'curated' is the hand-verified bundle in this
 * file; 'ticketmaster' is pulled by scripts/sync-ticketmaster.ts and only ever
 * exists as a backend row, never in the bundle. */
export type EventSource = 'curated' | 'ticketmaster';

export interface ScoperEvent {
  id: string;
  /** ISO timestamp in Oakland time. Missing timestamps are treated as archived listings. */
  startsAt?: string;
  name: string;
  time: string;
  priceLabel: string;
  travel: string;
  vibeTags?: string[];
  cats: EventCategory[];
  date: string;
  venue: string;
  venueId?: string;
  addr: string;
  lineup: string;
  know: string;
  priceFrom: string;
  allIn: string;
  ticketed: boolean;
  ticketUrl?: string;
  ticketProvider?: string;
  sourceUrl: string;
  verifiedLabel: string;
  image: string;
  /** Defaults to 'curated' when absent — every entry in this file is curated. */
  source?: EventSource;
  /** Set times, only where the official listing published them. Absent on most
   * events and rendered as nothing — never filled in with a plausible-looking
   * doors/support/headline sequence. */
  runOfShow?: { time: string; label: string; headline?: boolean }[];
}

export const EVENTS: Record<string, ScoperEvent> = {
  brandonFlowers: {
    id: 'brandonFlowers', startsAt: '2026-09-05T20:00:00-07:00', name: 'Brandon Flowers', time: '8 PM', priceLabel: 'Official tickets', travel: '6 min walk',
    vibeTags: ['Rock', 'The Killers frontman'], cats: ['Upcoming', 'Live music'],
    date: 'Sat Sep 5 · Doors 7 PM · Show 8 PM', venue: 'Fox Theater', venueId: 'fox', addr: '1807 Telegraph Ave · 6 min walk',
    lineup: 'Brandon Flowers',
    know: 'A LIVE 105-presented night at the Fox. Door and show times can change per the official listing.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://thefoxoakland.com/events/brandon-flowers-260905', ticketProvider: 'Fox Theater',
    sourceUrl: 'https://thefoxoakland.com/events/brandon-flowers-260905', verifiedLabel: 'Verified Jul 20 on the Fox official calendar',
    image: 'https://thefoxoakland.com/wp-content/uploads/2026/06/1024_BRANDON-FLOWERS-Approved-Press-Photo.jpg',
  },
  thieveryCorporation: {
    id: 'thieveryCorporation', startsAt: '2026-09-12T20:00:00-07:00', name: 'Thievery Corporation', time: '8 PM', priceLabel: 'Official tickets', travel: '6 min walk',
    vibeTags: ['Electronic + dub', '30th anniversary'], cats: ['Upcoming', 'Live music'],
    date: 'Sat Sep 12 · Doors 7 PM · Show 8 PM', venue: 'Fox Theater', venueId: 'fox', addr: '1807 Telegraph Ave · 6 min walk',
    lineup: 'Thievery Corporation',
    know: 'A 30th-anniversary retrospective tour stop, per the official listing.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://thefoxoakland.com/events/thievery-corporation-260912', ticketProvider: 'Fox Theater',
    sourceUrl: 'https://thefoxoakland.com/events/thievery-corporation-260912', verifiedLabel: 'Verified Jul 20 on the Fox official calendar',
    image: 'https://thefoxoakland.com/wp-content/uploads/2026/05/1024_ThieveryCorporation.jpg',
  },
  masego: {
    id: 'masego', startsAt: '2026-09-13T19:30:00-07:00', name: 'Masego', time: '7:30 PM', priceLabel: 'Official tickets', travel: '6 min walk',
    vibeTags: ['Trap house jazz', 'Saxophone'], cats: ['Upcoming', 'Live music'],
    date: 'Sun Sep 13 · Doors 6:30 PM · Show 7:30 PM', venue: 'Fox Theater', venueId: 'fox', addr: '1807 Telegraph Ave · 6 min walk',
    lineup: 'Masego',
    know: 'The Fix Your Face Tour at the Fox. Door and show times can change per the official listing.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://thefoxoakland.com/events/masego-260913', ticketProvider: 'Fox Theater',
    sourceUrl: 'https://thefoxoakland.com/events/masego-260913', verifiedLabel: 'Verified Jul 20 on the Fox official calendar',
    image: 'https://thefoxoakland.com/wp-content/uploads/2026/06/1024_Masego.jpg',
  },
  poppy: {
    id: 'poppy', startsAt: '2026-08-05T19:00:00-07:00', name: 'Poppy', time: '7 PM', priceLabel: 'Official tickets', travel: '6 min walk',
    vibeTags: ['Alternative', 'All ages', 'Three-artist bill'], cats: ['Upcoming', 'Live music'],
    date: 'Wed Aug 5 · Doors 6 PM · Show 7 PM', venue: 'Fox Theater', venueId: 'fox', addr: '1807 Telegraph Ave · 6 min walk',
    lineup: 'Poppy · LANDMVRKS · Thousand Below',
    know: 'An all-ages stop on the Constantly Nowhere Tour. The Fox notes that door and show times can change.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://thefoxoakland.com/events/poppy-260805', ticketProvider: 'Fox Theater',
    sourceUrl: 'https://thefoxoakland.com/events/poppy-260805', verifiedLabel: 'Checked Jul 19 on the Fox official calendar',
    image: 'https://thefoxoakland.com/wp-content/uploads/2026/02/1024_Poppy.jpg',
  },
  littleFeat: {
    id: 'littleFeat', startsAt: '2026-08-10T20:00:00-07:00', name: 'Little Feat', time: '8 PM', priceLabel: 'Official tickets', travel: '6 min walk',
    vibeTags: ['Rock and blues', 'All ages', 'Farewell tour'], cats: ['Upcoming', 'Live music'],
    date: 'Mon Aug 10 · Doors 7 PM · Show 8 PM', venue: 'Fox Theater', venueId: 'fox', addr: '1807 Telegraph Ave · 6 min walk',
    lineup: 'Little Feat · Grahame Lesh',
    know: 'An all-ages Oakland stop on The Last Farewell Tour, with food and drinks at The Den before doors.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://thefoxoakland.com/events/little-feat-260810', ticketProvider: 'Fox Theater',
    sourceUrl: 'https://thefoxoakland.com/events/little-feat-260810', verifiedLabel: 'Checked Jul 19 on the Fox official calendar',
    image: 'https://thefoxoakland.com/wp-content/uploads/2026/01/1024_Little-Feat.jpg',
  },
  passionPit: {
    id: 'passionPit', startsAt: '2026-08-16T19:30:00-07:00', name: 'Passion Pit', time: '7:30 PM', priceLabel: 'Official tickets', travel: '6 min walk',
    vibeTags: ['Indie pop', 'All ages', 'Live 105'], cats: ['Upcoming', 'Live music'],
    date: 'Sun Aug 16 · Doors 6:30 PM · Show 7:30 PM', venue: 'Fox Theater', venueId: 'fox', addr: '1807 Telegraph Ave · 6 min walk',
    lineup: 'Passion Pit · Arden Jones',
    know: 'An all-ages date on The Pretty Penny Tour, presented by Live 105.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://thefoxoakland.com/events/passion-pit-260816', ticketProvider: 'Fox Theater',
    sourceUrl: 'https://thefoxoakland.com/events/passion-pit-260816', verifiedLabel: 'Checked Jul 19 on the Fox official calendar',
    image: 'https://thefoxoakland.com/wp-content/uploads/2026/03/1024_passionpit.jpg',
  },
  seijiOda: {
    id: 'seijiOda', startsAt: '2026-08-07T17:00:00-07:00', name: 'Friday Nights at OMCA with seiji oda', time: '5 PM', priceLabel: 'Free', travel: '15 min walk',
    vibeTags: ['Hip-hop', 'DJ set', 'Outdoor campus'], cats: ['Upcoming', 'Live music', 'Outdoor'],
    date: 'Fri Aug 7 · 5–9 PM', venue: 'OMCA campus', addr: '1000 Oak St · 15 min walk',
    lineup: 'seiji oda · DJ Benet',
    know: 'A free Friday-night campus program with live music, a DJ set, community art, gallery chats, food trucks, and late museum access with admission.',
    priceFrom: 'Free', allIn: 'Free', ticketed: false,
    sourceUrl: 'https://museumca.org/event/friday-nights-at-omca-with-seiji-oda/', verifiedLabel: 'Checked Jul 19 on OMCA’s official event page',
    image: 'https://museumca.org/wp-content/uploads/2026/07/8.7_seiji-oda_3-scaled.jpeg',
  },
  jillScott: {
    id: 'jillScott', startsAt: '2026-08-07T19:30:00-07:00', name: 'Jill Scott', time: '7:30 PM', priceLabel: 'Official tickets', travel: '7 min walk',
    vibeTags: ['R&B and soul', 'Phone-free show', 'Reserved seating'], cats: ['Upcoming', 'Live music'],
    date: 'Fri Aug 7 · Doors 6:30 PM · Show 7:30 PM', venue: 'Paramount Theatre', venueId: 'paramount', addr: '2025 Broadway · 7 min walk',
    lineup: 'Jill Scott · J Bambii',
    know: 'The To Whom This May Concern Tour uses Yondr phone-free pouches. The Paramount recommends arriving before showtime.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://www.paramountoakland.org/events/detail/jill-scott-to-whom-it-may-concern', ticketProvider: 'Paramount Theatre',
    sourceUrl: 'https://www.paramountoakland.org/events/detail/jill-scott-to-whom-it-may-concern', verifiedLabel: 'Checked Jul 19 on the Paramount official calendar',
    image: 'https://www.paramountoakland.org/assets/img/Jill-Scott-image-1200x500-2affb0ad5f.jpg',
  },
  ashleyMehta: {
    id: 'ashleyMehta', startsAt: '2026-08-14T17:00:00-07:00', name: 'Friday Nights at OMCA with Ashley Mehta', time: '5 PM', priceLabel: 'Free', travel: '15 min walk',
    vibeTags: ['R&B and pop', 'Dance lesson', 'Outdoor campus'], cats: ['Upcoming', 'Live music', 'Outdoor'],
    date: 'Fri Aug 14 · 5–9 PM', venue: 'OMCA campus', addr: '1000 Oak St · 15 min walk',
    lineup: 'Ashley Mehta · BRIIZA',
    know: 'A free Friday night with live music, a DJ set, a locking dance lesson, gallery chats, food trucks, and late museum access with admission.',
    priceFrom: 'Free', allIn: 'Free', ticketed: false,
    sourceUrl: 'https://museumca.org/event/friday-nights-at-omca-with-ashley-mehta/', verifiedLabel: 'Checked Jul 19 on OMCA’s official event page',
    image: 'https://museumca.org/wp-content/uploads/2026/07/8.14_Ashley-Mehta_2-e1784071292915.jpg',
  },
  sabrinaShauna: {
    id: 'sabrinaShauna', startsAt: '2026-08-21T17:00:00-07:00', name: 'Friday Nights at OMCA with Sabrina Shauna', time: '5 PM', priceLabel: 'Free', travel: '15 min walk',
    vibeTags: ['R&B', 'Live drawing', 'Outdoor campus'], cats: ['Upcoming', 'Live music', 'Outdoor'],
    date: 'Fri Aug 21 · 5–9 PM', venue: 'OMCA campus', addr: '1000 Oak St · 15 min walk',
    lineup: 'Sabrina Shauna · DJ Zaynub',
    know: 'A free Friday-night program with live music, a DJ set, figure drawing, gallery chats, food trucks, and late museum access with admission.',
    priceFrom: 'Free', allIn: 'Free', ticketed: false,
    sourceUrl: 'https://museumca.org/event/friday-nights-at-omca-with-sabrina-shauna/', verifiedLabel: 'Checked Jul 19 on OMCA’s official event page',
    image: 'https://museumca.org/wp-content/uploads/2026/07/8.21_Sabrina-Shauna_4-scaled.jpg',
  },
  bradMehldau: {
    id: 'bradMehldau', startsAt: '2026-08-29T20:00:00-07:00', name: 'Brad Mehldau: Ride into the Sun', time: '8 PM', priceLabel: 'Official tickets', travel: '7 min walk',
    vibeTags: ['Jazz', 'Elliott Smith tribute', 'Orchestra'], cats: ['Upcoming', 'Live music'],
    date: 'Sat Aug 29 · Show 8 PM', venue: 'Paramount Theatre', venueId: 'paramount', addr: '2025 Broadway · 7 min walk',
    lineup: 'Brad Mehldau · Chris Thile · Blake Mills · Matt Chamberlain · John Davis · USC Thornton Chamber Virtuosi',
    know: 'A live presentation of Ride into the Sun, Mehldau’s Elliott Smith tribute album, with band and chamber orchestra.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://www.paramountoakland.org/events/detail/brad-mehldau-ride-into-the-sun', ticketProvider: 'Paramount Theatre',
    sourceUrl: 'https://www.paramountoakland.org/events/detail/brad-mehldau-ride-into-the-sun', verifiedLabel: 'Checked Jul 19 on the Paramount official calendar',
    image: 'https://www.paramountoakland.org/assets/img/image-1200x500-21-1-6cd6a530fb.jpg',
  },
  melbaMoore: {
    id: 'melbaMoore', startsAt: '2026-08-05T19:30:00-07:00', name: 'Melba Moore', time: '7:30 PM', priceLabel: 'Official tickets', travel: 'ride 6 min',
    vibeTags: ['Soul + R&B', 'Legendary vocalist'], cats: ['Upcoming', 'Live music'],
    date: 'Wed Aug 5 · Doors 7 PM · Show 7:30 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Melba Moore',
    know: 'Legendary singer and actress. Meet-and-greet tickets are sold separately on the official page.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/melba-moore-1/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/melba-moore-1/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2933/thumb_melba-moore-copy.jpeg',
  },
  robertCray: {
    id: 'robertCray', startsAt: '2026-08-10T20:00:00-07:00', name: 'The Robert Cray Band', time: '8 PM', priceLabel: '$89–$129', travel: 'ride 6 min',
    vibeTags: ['Blues', 'Guitar legend'], cats: ['Upcoming', 'Live music'],
    date: 'Mon Aug 10 · Doors 7:30 PM · Show 8 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'The Robert Cray Band',
    know: 'Five-time Grammy-winning blues guitarist and songwriter. Two seating tiers on the official listing.',
    priceFrom: '$89', allIn: '$89–$129', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/robert-cray-band-7/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/robert-cray-band-7/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2922/thumb_robert-cray---ad-mat-2---photo-credit-melanie-lemahieu-copy.jpeg',
  },
  stylistics: {
    id: 'stylistics', startsAt: '2026-08-18T20:00:00-07:00', name: 'The Stylistics', time: '8 PM', priceLabel: '$69–$109', travel: 'ride 6 min',
    vibeTags: ['Philly soul', 'Best-selling group'], cats: ['Upcoming', 'Live music'],
    date: 'Tue Aug 18 · Doors 7:30 PM · Show 8 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'The Stylistics',
    know: 'One of the best-selling soul groups ever. Check the official calendar for additional listed nights.',
    priceFrom: '$69', allIn: '$69–$109', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/the-stylistics-17/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/the-stylistics-17/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2822/thumb_the-stylistics2-copy.jpg',
  },
  keikoMatsui: {
    id: 'keikoMatsui', startsAt: '2026-08-25T19:30:00-07:00', name: 'Keiko Matsui', time: '7:30 PM', priceLabel: 'Official tickets', travel: 'ride 6 min',
    vibeTags: ['Contemporary jazz', 'Piano'], cats: ['Upcoming', 'Live music'],
    date: 'Tue Aug 25 · Doors 7 PM · Show 7:30 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Keiko Matsui',
    know: 'Internationally acclaimed pianist and composer, per the official listing.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/keiko-matsui-14/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/keiko-matsui-14/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2866/thumb_keikomatsui2-copy.jpeg',
  },
  roseRoyce: {
    id: 'roseRoyce', startsAt: '2026-09-12T19:30:00-07:00', name: 'Rose Royce', time: '7:30 PM', priceLabel: 'Official tickets', travel: 'ride 6 min',
    vibeTags: ['Funk + soul', '“Car Wash” legends'], cats: ['Upcoming', 'Live music'],
    date: 'Sat Sep 12 · Doors 7 PM · Show 7:30 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Rose Royce',
    know: 'Grammy-winning, multi-platinum legends of the “Car Wash” soundtrack, per the official listing.',
    priceFrom: 'See site', allIn: 'Official ticketing', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/rose-royce-4/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/rose-royce-4/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2847/thumb_rose-royce-new-group-image-2026-copy.png',
  },
  kamasiWashington: {
    id: 'kamasiWashington', startsAt: '2026-09-13T19:00:00-07:00', name: 'Kamasi Washington', time: '7 PM', priceLabel: '$69–$99', travel: 'ride 6 min',
    vibeTags: ['Jazz', 'Saxophone', 'Two shows'], cats: ['Upcoming', 'Live music'],
    date: 'Sun Sep 13 · Shows 7 + 9 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Kamasi Washington',
    know: 'Sought-after composer, bandleader and jazz saxophonist. Early show 7 PM, late show 9 PM per the official listing.',
    priceFrom: '$69', allIn: '$69–$99', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/kamasi-washington/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/kamasi-washington/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2961/thumb_kamasi-washington-2-copy.jpeg',
  },
  bigDaddyKane: {
    id: 'bigDaddyKane', startsAt: '2026-09-18T19:30:00-07:00', name: 'Big Daddy Kane', time: '7:30 PM', priceLabel: '$74–$99', travel: 'ride 6 min',
    vibeTags: ['Hip-hop', 'Golden era', 'Two shows'], cats: ['Upcoming', 'Live music'],
    date: 'Fri Sep 18 · Shows 7:30 + 9:30 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Big Daddy Kane',
    know: 'One of the most influential and skilled MCs in hip-hop, per the official listing. Two shows.',
    priceFrom: '$74', allIn: '$74–$99', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/big-daddy-kane-2/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/big-daddy-kane-2/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2981/thumb_bdk.jpg',
  },
  spyroGyra: {
    id: 'spyroGyra', startsAt: '2026-09-29T19:30:00-07:00', name: 'Spyro Gyra', time: '7:30 PM', priceLabel: '$44–$84', travel: 'ride 6 min',
    vibeTags: ['Contemporary jazz', 'Fusion'], cats: ['Upcoming', 'Live music'],
    date: 'Tue Sep 29 · Doors 7 PM · Show 7:30 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Spyro Gyra',
    know: 'Contemporary jazz icons. A second night is listed on the official calendar — check for Sep 30.',
    priceFrom: '$44', allIn: '$44–$84', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/spyro-gyra-6/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/spyro-gyra-6/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2941/thumb_spyro-gyra-2-copy.jpeg',
  },
  musiqSoulchild: {
    id: 'musiqSoulchild', startsAt: '2026-10-09T19:30:00-07:00', name: 'Musiq Soulchild', time: '7:30 PM', priceLabel: '$79–$145', travel: 'ride 6 min',
    vibeTags: ['R&B', 'Neo-soul', 'Two shows'], cats: ['Upcoming', 'Live music'],
    date: 'Fri Oct 9 · Shows 7:30 + 9:30 PM', venue: 'Yoshi’s', venueId: 'yoshis', addr: '510 Embarcadero W · ride 6 min',
    lineup: 'Musiq Soulchild',
    know: 'One of the most influential R&B singers of his generation, per the official listing. Two shows.',
    priceFrom: '$79', allIn: '$79–$145', ticketed: true,
    ticketUrl: 'https://yoshis.com/events/buy-tickets/musiq-soulchild-46/detail', ticketProvider: 'Yoshi’s',
    sourceUrl: 'https://yoshis.com/events/buy-tickets/musiq-soulchild-46/detail', verifiedLabel: 'Verified Jul 20 on Yoshi’s official calendar',
    image: 'https://yoshis.com/userfiles/events/images/2732/thumb_msc2-copy.jpeg',
  },
};
