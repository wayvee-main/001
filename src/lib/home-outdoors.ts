/** Home-only walking ideas. No invented GPS distance, difficulty or opening status.
 * Source pages checked October 21, 2026; current access remains with the park.
 * Keep Oakland and San Francisco separate, as with the app's other city pools. */
export type HomeOutdoor = { id: string; city: string; name: string; caption: string; glyph: string; description: string; source: string };
export const HOME_OUTDOORS: readonly HomeOutdoor[] = [
  {id:'lake-merritt',city:'oakland',name:'Lake Merritt',caption:'Waterside paths · Oakland',glyph:'walk',description:'A walk around the lake, with as much or as little of the loop as you want.',source:'https://www.visitoakland.com/listing/lake-merritt/122/'},
  {id:'reinhardt-redwood',city:'oakland',name:'Reinhardt Redwood',caption:'Redwood trails · Oakland Hills',glyph:'hike',description:'Forest trails in Dr. Aurelia Reinhardt Redwood Regional Park. Check the park’s current trail alerts before choosing a route.',source:'https://www.ebparks.org/parks/reinhardt-redwood'},
  {id:'lake-temescal',city:'oakland',name:'Lake Temescal',caption:'Waterside paths · Oakland Hills',glyph:'walk',description:'A smaller waterside escape at Temescal Regional Recreation Area. Consult current park notices for access and trail conditions.',source:'https://www.ebparks.org/parks/temescal'},
  {id:'lands-end',city:'san-francisco',name:'Lands End',caption:'Coastal trails · San Francisco',glyph:'hike',description:'Coastal paths, cypress and views along San Francisco’s northwestern shore. Choose a route using the park’s current guidance.',source:'https://www.nps.gov/goga/planyourvisit/landsend.htm'},
  {id:'golden-gate-park',city:'san-francisco',name:'Golden Gate Park',caption:'Park paths · San Francisco',glyph:'walk',description:'Gardens, groves, lakes and park paths, with room for a short outing or a longer wander.',source:'https://sfrecpark.org/770/Golden-Gate-Park'},
  {id:'presidio-trails',city:'san-francisco',name:'Presidio trails',caption:'Walks & hikes · San Francisco',glyph:'hike',description:'Choose among the Presidio’s coastal hikes and gentler paths using the official trail maps.',source:'https://presidio.gov/explore/trails'},
];
