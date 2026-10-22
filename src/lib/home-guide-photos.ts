/** Home-only photo enrichment, checked against these official pages on
 * 2026-10-21. Never substitute another branch's room or a generic stock photo.
 * Keep Discover's native records unchanged. */
export const HOME_GUIDE_PHOTOS: Record<string, {image:string;source:string}> = {
  'restaurant:brendas': {
    image:'https://brendasoakland.com/wp-content/uploads/2020/04/Brendas_10219_1afl_Home-Page.jpg',
    source:'https://brendasoakland.com/',
  },
  'restaurant:lakechalet': {
    image:'https://images.squarespace-cdn.com/content/v1/68b19e834fb4592570249a87/49c99216-ff39-4d46-b5c4-2aa6f21ff49e/Reception+on+Center+dock-pier-adj.jpg?format=300w',
    source:'https://www.thelakechalet.com/',
  },
  'restaurant:sliver': {
    image:'https://www.sliverpizzeria.com/images/brand/sliver-hero.webp',
    source:'https://www.sliverpizzeria.com/',
  },
  'restaurant:squarepie': {
    image:'https://storage.googleapis.com/open-merchant-app-assets/media/89511f94-4cc9-44b0-b271-05f4dc057f0d/5a8b73cd-c572-4e00-b244-1461e861ee56/2%206x8%20%281%29%20%281%29.jpg',
    source:'https://www.squarepieguys.com/',
  },
  'outdoor:reinhardt-redwood': {
    image:'https://www.ebparks.org/sites/default/files/16x9_Reinhardt%20Redwood_Gary%20Crabbe.jpg',
    source:'https://www.ebparks.org/parks/reinhardt-redwood',
  },
  'outdoor:lands-end': {
    image:'https://www.nps.gov/common/uploads/grid_builder/goga/crop1_1/C11A5CF8-1DD8-B71B-0B4E8ECEC7E3EC97.jpg?width=300&quality=80&mode=crop',
    source:'https://www.nps.gov/goga/planyourvisit/landsend.htm',
  },
};
