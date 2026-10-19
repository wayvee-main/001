/** Venue-owned photos verified against the official location pages, 2026-10-19.
 * Overture carries no photos and the nearby OSM snapshot often has image=null.
 * Key by the exact map ID, never a city-agnostic business-name match. */
export const VERIFIED_PLACE_PHOTOS: Record<string,{image:string;source:string}> = {
  'osm:1629071719': {
    image:'https://images.squarespace-cdn.com/content/v1/6a29a6d7e70b7e5dd5a58c06/a02a0f69-efda-4e1d-b8fa-05b6547a91e7/IMG_2492.jpeg?format=750w',
    source:'https://www.brokendreamsoakland.com/',
  },
  'osm:1186413846': {
    image:'https://www.highwirecoffee.com/cdn/shop/files/2023-broadway-10.jpg?v=1698325885&width=750',
    source:'https://www.highwirecoffee.com/pages/locations/broadway',
  },
  'osm:1186413904': {
    image:'https://static.wixstatic.com/media/ce8f56_e82da2d1759b4f4bb78d1cf2f9a42865~mv2.png/v1/fill/w_600,h_600,al_c,q_85/ce8f56_e82da2d1759b4f4bb78d1cf2f9a42865~mv2.png',
    source:'https://www.goldenlotusvegan.co/',
  },
};

/** A supplied photo wins; a null/empty live or cached field keeps the verified
 * venue photo. Unknown IDs remain without a photo instead of borrowing stock. */
export function imageForPlace(place:{id:string;image?:string|null}):string|undefined {
  return place.image?.trim()||VERIFIED_PLACE_PHOTOS[place.id]?.image;
}
