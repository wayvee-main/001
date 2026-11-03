/** Native venue photos keyed to the actual preview, never a generic category.
 * Bundled images are available on first paint/offline. Other picks use their
 * own verified catalog image; a missing/failed photo keeps the category glyph.
 * Provenance: assets/images/home-windows/README.md.
 */
export const HOME_TILE_PREVIEW_PHOTOS: Record<string, { source: number; label: string }> = {
  '/place/osm:2306696660': { source: require('../../assets/images/local-perks/bocanova.jpg'), label: 'Food at Bocanova, from its official website' },
  '/night/bar-shiru': { source: require('../../assets/images/local-perks/bar-shiru.jpg'), label: 'Cocktail preparation at Bar Shiru, from its official website' },
  '/restaurant/itani': { source: require('../../assets/images/local-perks/itani.jpg'), label: 'Itani Ramen, from its official website' },
  '/restaurant/mua': { source: require('../../assets/images/home-windows/eat.jpg'), label: 'Diners in the actual MUA Oakland dining room' },
  '/night/little-bird': { source: require('../../assets/images/home-windows/bars.jpg'), label: 'Little Bird’s window on 13th Street, Oakland' },
  '/crawl/uptown': { source: require('../../assets/images/home-windows/routes.jpg'), label: 'The Fox Theater marquee in the Uptown route’s neighborhood' },
};
