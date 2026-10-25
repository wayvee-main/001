import type { Restaurant } from './data';

const nameKey=(name:string)=>name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/\b(the|and|oakland|restaurant|cafe|café|lounge|kitchen)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
export const streetKey=(address?:string|null)=>address?.split(/[,·\n]/)[0].toLowerCase().replace(/\b(street|avenue|boulevard|road|drive|lane|court)\b/g,word=>({street:'st',avenue:'ave',boulevard:'blvd',road:'rd',drive:'dr',lane:'ln',court:'ct'}[word]!)).replace(/[^a-z0-9]/g,'')||'';

/** Menus can cross the curated/map-ID boundary only for one confidently
 * matched establishment in the same city. A name or street number alone is
 * not enough to move another branch's menu and prices. */
export function restaurantForPlace(place:{name:string;address?:string|null},restaurants:readonly Restaurant[],city:string):Restaurant|undefined {
  if(city!=='oakland')return;
  const address=streetKey(place.address),name=nameKey(place.name);
  if(!address||!name)return;
  const candidates=restaurants.filter(restaurant=>streetKey(restaurant.address)===address&&nameKey(restaurant.name)===name);
  return candidates.length===1?candidates[0]:undefined;
}

export function placeForListing<T extends {name:string;address?:string|null}>(entry:{name:string;address?:string|null},places:readonly T[],city:string):T|undefined {
  if(city!=='oakland')return;
  const address=streetKey(entry.address),name=nameKey(entry.name);if(!address||!name)return;
  const matches=places.filter(place=>streetKey(place.address)===address&&nameKey(place.name)===name);return matches.length===1?matches[0]:undefined;
}
export const placeForRestaurant=placeForListing;
