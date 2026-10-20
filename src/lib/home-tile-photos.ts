/** Complete venue-owned photos for Oakland's category windows. Bundling makes
 * them available on first paint and offline. Do not reuse Oakland landmarks
 * for another city; an unsourced city keeps the category glyph instead.
 * Original sources and subject descriptions: assets/images/home-windows/README.md.
 */
export const OAKLAND_HOME_TILE_PHOTOS = {
  eat: { source: require('../../assets/images/home-windows/eat.jpg'), label: 'A table setting at Mägo in Oakland' },
  bars: { source: require('../../assets/images/home-windows/bars.jpg'), label: 'The bar at Bar Shiru in Oakland' },
  routes: { source: require('../../assets/images/home-windows/routes.jpg'), label: 'The Fox Theater exterior in Uptown Oakland' },
  events: { source: require('../../assets/images/home-windows/events.jpg'), label: 'The stage and auditorium at Oakland’s Paramount Theatre' },
} satisfies Record<string, { source: number; label: string }>;
