import { parseDetailContent, type DetailContent } from '../../src/lib/detail-content';

const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const arr=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.map(obj):[];
const str=(value:unknown)=>typeof value==='string'?value.trim():undefined;
function image(value:unknown):string|undefined {
  const photos=arr(value).filter(photo=>str(photo.url)?.startsWith('https://')&&!photo.fallback);
  return str(photos.sort((a,b)=>Number(b.width||0)-Number(a.width||0))[0]?.url);
}

/** Retain the actual artist, venue and listing content already returned by
 * Discovery. Names, images and policies are never filled from another show. */
export function ticketmasterDetailContent(input:unknown,now=new Date()):DetailContent|undefined {
  const event=obj(input),embedded=obj(event._embedded),venue=arr(embedded.venues)[0]||{},sourceUrl=str(event.url);
  if(!sourceUrl)return;
  const artists=arr(embedded.attractions).flatMap(artist=>{
    const name=str(artist.name);if(!name)return [];
    const homes=arr(obj(artist.externalLinks).homepage);
    return [{name,image:image(artist.images),url:str(homes[0]?.url)||str(artist.url)||sourceUrl}];
  });
  const notes=[
    {title:'About this event',body:str(event.info)},
    {title:'Good to know',body:str(event.pleaseNote)},
    {title:'Ticket limit',body:str(obj(event.ticketLimit).info)},
    {title:'Accessibility',body:str(obj(event.accessibility).info)},
    {title:'At the venue',body:str(obj(venue.generalInfo).generalRule)},
    {title:'Admission',body:str(obj(venue.generalInfo).childRule)},
    {title:'Access & seating',body:str(venue.accessibleSeatingDetail)},
    {title:'Getting there',body:str(venue.parkingDetail)},
    {title:'Box office',body:str(obj(venue.boxOfficeInfo).openHoursDetail)},
  ].filter(note=>note.body).filter((note,index,all)=>all.findIndex(other=>other.body===note.body)===index);
  const address=obj(venue.address),city=obj(venue.city);
  return parseDetailContent({version:1,sourceUrl,verifiedAt:now.toISOString(),artists,notes,
    venue:venue.name?{name:venue.name,address:[address.line1,city.name].filter(Boolean).join(', '),image:image(venue.images),url:venue.url}:undefined,
    links:[{label:'Official tickets',url:sourceUrl}]});
}
