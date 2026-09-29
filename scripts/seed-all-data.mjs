const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before seeding.');
  console.error('The secret key bypasses row-level security — keep it out of the repo and out of chat.');
  process.exit(1);
}


const PLACES = [
  {
    id: 'pl_calavera',
    name: 'Calavera',
    category: 'Mexican',
    address: '2337 Broadway, Oakland, CA 94612',
    lat: 37.8124,
    lon: -122.2687,
    cuisine: 'Oaxacan / Mexican',
    opening_hours: '5:00 PM - 10:00 PM',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
    website: 'https://calaveraoakland.com'
  },
  {
    id: 'pl_parche',
    name: 'Parche',
    category: 'Colombian',
    address: '2293 Broadway, Oakland, CA 94612',
    lat: 37.8121,
    lon: -122.2685,
    cuisine: 'Contemporary Colombian',
    opening_hours: '5:00 PM - 10:00 PM',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
    website: 'https://parcheoakland.com'
  },
  {
    id: 'pl_viridian',
    name: 'Viridian',
    category: 'Cocktail Bar & Asian Lounge',
    address: '2216 Broadway, Oakland, CA 94612',
    lat: 37.8115,
    lon: -122.2682,
    cuisine: 'Asian American Snacks & Cocktails',
    opening_hours: '5:00 PM - 1:00 AM',
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b',
    website: 'https://viridianbar.com'
  },
  {
    id: 'pl_drakes',
    name: "Drake's Dealership",
    category: 'Beer Garden & Pizza',
    address: '2325 Broadway, Oakland, CA 94612',
    lat: 37.8123,
    lon: -122.2686,
    cuisine: 'Craft Beer & Wood-fired Pizza',
    opening_hours: '11:30 AM - 11:00 PM',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    website: 'https://drinkdrakes.com'
  },
  {
    id: 'pl_low_bar',
    name: 'Low Bar',
    category: 'Cocktail Bar & Kitchen',
    address: '2411 Webster St, Oakland, CA 94612',
    lat: 37.8130,
    lon: -122.2665,
    cuisine: 'Mexican & Modern Comfort',
    opening_hours: '4:00 PM - 12:00 AM',
    image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34',
    website: 'https://lowbaroakland.com'
  },
  {
    id: 'pl_fox_theater_venue',
    name: 'Fox Theater Oakland',
    category: 'Music Venue',
    address: '1807 Telegraph Ave, Oakland, CA 94612',
    lat: 37.8080,
    lon: -122.2704,
    cuisine: 'Live Performance & Concerts',
    opening_hours: 'Varies per show',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    website: 'https://thefoxoakland.com'
  }
];

const EVENTS = [
  {
    id: 'ev_fox_concert_01',
    name: 'Oakland Indie Music Night',
    starts_at: '2026-08-15T20:00:00Z',
    time_label: '8:00 PM',
    date_label: 'Aug 15',
    price_label: '$35 - $65',
    price_from: 3500,
    all_in: false,
    travel: '5 min walk',
    venue: 'Fox Theater Oakland',
    venue_id: 'pl_fox_theater_venue',
    addr: '1807 Telegraph Ave, Oakland, CA',
    cats: ['Concert', 'Live Music'],
    vibe_tags: ['Upbeat', 'Indie'],
    ticket_provider: 'Ticketmaster',
    ticket_url: 'https://thefoxoakland.com',
    source_url: 'https://thefoxoakland.com',
    verified_label: 'Official Listing',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    source: 'curated',
    lineup: [],
    know: []
  },
  {
    id: 'ev_uptown_art_walk',
    name: 'Uptown First Friday Art Walk',
    starts_at: '2026-08-21T18:00:00Z',
    time_label: '6:00 PM',
    date_label: 'Aug 21',
    price_label: 'Free',
    price_from: 0,
    all_in: true,
    travel: '2 min walk',
    venue: 'Telegraph & 25th St',
    addr: 'Telegraph Ave, Oakland, CA',
    cats: ['Art', 'Community'],
    vibe_tags: ['Social', 'Outdoors'],
    ticket_provider: 'Wayvee',
    ticket_url: 'https://oaklandfirstfridays.org',
    source_url: 'https://oaklandfirstfridays.org',
    verified_label: 'Community Event',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
    source: 'curated',
    lineup: [],
    know: []
  }
];

async function seedAll() {
  console.log('Seeding curated venues and events into Supabase...');

  for (const place of PLACES) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/places`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(place)
    });
    console.log(`Place "${place.name}":`, res.status, res.statusText);
  }

  for (const ev of EVENTS) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ev)
    });
    console.log(`Event "${ev.name}":`, res.status, res.statusText);
  }

  console.log('Seed completed successfully!');
}

seedAll().catch(console.error);
