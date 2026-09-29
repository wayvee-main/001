// Centralized outbound handoffs — rides, delivery, and anything else that leaves the app.
//
// Uber/DoorDash/Lyft/Ticketmaster affiliate partnerships are still in progress. Every
// link a user can tap lives here so that once tracking IDs/affiliate params are issued,
// they get added in ONE place instead of hunting through every screen. Nothing here
// pretends a booking/order completed — we hand off to the real app or site and let it
// do the actual transaction, same as the rest of the app's "no mock data" pattern.

/** Splits "510 Embarcadero W · ride 6 min · ~$9" down to the street address. */
export function streetAddress(addr: string): string {
  return addr.split(' · ')[0].trim();
}

/** High-resolution brand mark exposed for the domain behind an official venue site. */
export function siteLogoLink(siteUrl: string): string {
  try {
    const domain = new URL(siteUrl).hostname.replace(/^www\./, '');
    const officialLogos: Record<string, string> = {
      'thecookandherfarmer.com': 'https://www.thecookandherfarmer.com/uploads/b/0e203570-b561-11e9-959b-cdfa8630d177/Asset%203_OTQ5Mj.png',
      'tacossinaloaoakland.com': 'https://images.squarespace-cdn.com/content/v1/609da33f7eded45e1950ce1f/dd4fa2c7-e344-419d-8ef9-115ef40c2c8c/tacos-sinloa-logo.png?format=1500w',
      'itaniramen.com': 'https://images.squarespace-cdn.com/content/v1/54c0429de4b07740895e80d1/1444007187731-8FOTSR6JB0BW01VKHKQA/ItaniRamen_RGB_Mark_Red.png?format=1500w',
      'colonialdonuts.shop': 'https://colonialdonuts.shop/public/media/thumb/colonialdonuts-shop/logo-share-192x192.jpg',
      'yoshis.com': 'https://yoshis.com/images/yoshi-logo.png',
      'thefoxoakland.com': 'https://thefoxoakland.com/wp-content/themes/foxchild/assets/img/fox-oakland-logo-x2.png',
      'paramountoakland.org': 'https://www.paramountoakland.org/assets/production/66c3d88376//images/header-logo.png',
      'elismilehighclub.com': 'https://static.wixstatic.com/media/4a4730_7ccdde15bf264019a464a9d38a24a190~mv2.png',
    };
    if (officialLogos[domain]) return officialLogos[domain];
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
  } catch {
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(siteUrl)}&sz=256`;
  }
}

/**
 * Uber universal link — opens the Uber app if installed, else uber.com.
 * Documented format, no geocoding required: https://developer.uber.com/docs/riders/ride-requests/deep-links
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  label?: string;
}

export function uberRideLink(destinationAddress: string, destinationName?: string, pickup?: Coordinates): string {
  const params = new URLSearchParams({
    action: 'setPickup',
    'dropoff[formatted_address]': destinationAddress,
  });
  if (pickup) {
    params.set('pickup[latitude]', String(pickup.latitude));
    params.set('pickup[longitude]', String(pickup.longitude));
    params.set('pickup[nickname]', pickup.label || 'Current location');
  } else {
    params.set('pickup', 'my_location');
  }
  if (destinationName) params.set('dropoff[nickname]', destinationName);
  return `https://m.uber.com/ul/?${params.toString()}`;
}

/**
 * Lyft's deep-link API requires lat/lng for a prefilled destination, which we don't have
 * geocoded per venue. Opening the rider app/site is the honest fallback until that's wired up.
 */
export function lyftRideLink(): string {
  return 'https://www.lyft.com/rider';
}

/** Verified provider destinations used by the compact promotion system. */
export const PROMOTION_LINKS = {
  uberEatsOakland: 'https://www.ubereats.com/category/oakland-ca',
  doorDashOaklandDeals: 'https://www.doordash.com/en/food-delivery/oakland-ca-restaurants/deals/',
  lyftFirstRide: 'https://www.lyft.com/ride-with-lyft?invite=50OFF1WB',
  lyftRider: 'https://www.lyft.com/rider',
  uberRide: 'https://www.uber.com/us/en/ride/',
  uberOne: 'https://www.uber.com/us/en/uber-one/',
  dashPass: 'https://www.doordash.com/dashpass/',
} as const;

/** Uber Eats — restaurant-specific store IDs aren't available yet, so this opens search. */
export function uberEatsLink(): string {
  return 'https://www.ubereats.com/';
}

/** DoorDash — same caveat as Uber Eats above. */
export function doorDashLink(): string {
  return 'https://www.doordash.com/';
}

/** Ticketmaster's affiliate program is verified (see docs/how-we-make-money.md) but no
 * partner tracking-link format has been issued yet — plain search until a real affiliate
 * deep link is available, same "hand off honestly, don't fake a tracked link" rule as
 * everywhere else in this file. */
export function ticketmasterSearchLink(query: string): string {
  return `https://www.ticketmaster.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Every ticket handoff (Ticketmaster-sourced or a venue's own box office) routes through
 * here so the affiliate click-ref lands in ONE place instead of every screen that opens a
 * ticket link. Unset env var means no ref issued yet — the URL passes through unchanged,
 * same "don't fake a tracked link" rule as ticketmasterSearchLink above.
 */
export function ticketLink(url: string): string {
  const clickRef = process.env.EXPO_PUBLIC_TICKETMASTER_CLICK_REF?.trim();
  if (!clickRef) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('clickref', clickRef);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function mapsSearchLink(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Opens a real point-to-point directions handoff with the user's location as origin. */
export function mapsDirectionsLink(destination: string, origin?: Coordinates): string {
  const params = new URLSearchParams({ api: '1', destination });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function uberOneLink(): string {
  return PROMOTION_LINKS.uberOne;
}

export function dashPassLink(): string {
  return PROMOTION_LINKS.dashPass;
}
