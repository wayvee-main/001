import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { eventDayGroupLabel, type Crawl, type NightlifeSpot, type Restaurant, type ScoperEvent, type Venue } from '@/lib/data';
import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

function briefWords(value:string,max:number):string {
  const words=value.trim().split(/\s+/);
  return words.length>max?`${words.slice(0,max).join(' ').replace(/[.,;:!?–—-]+$/,'')}…`:value.trim();
}

function heroDescription(x:ScoperEvent):string {
  let text=(x.know||x.lineup).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  const intro=`An Evening With ${x.name.replace(/:/g,'').replace(/\s+/g,' ').trim()}`;
  if(text.toLowerCase().startsWith(intro.toLowerCase()))text=text.slice(intro.length).trim();
  const sentence=text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||text;
  return briefWords(sentence,20);
}

export function NoteFact({glyph,value,label,compact=false,flexible=false}:{glyph:string;value:string;label?:string;compact?:boolean;flexible?:boolean}) {
  const colors=useThemeColors();
  return <View accessibilityLabel={label||value} className="flex-row items-center gap-x-1" style={compact?{minWidth:0,flexShrink:flexible?1:0,flexGrow:flexible?1:0}:undefined}>
    <Glyph name={glyph} size={12} color={colors['fg-muted']} />
    <Text numberOfLines={compact?1:undefined} className="font-dm text-fine text-taupe" style={compact?{minWidth:0,flexShrink:1}:undefined}>{value}</Text>
  </View>;
}

/** Shared photo-note geometry for Discover strips and Home's category grid. */
export const PHOTO_NOTE = {
  width: 137,
  padding: 8,
  radius: 12,
  photoWidth: 121,
  photoHeight: 73,
  photoRadius: 8,
  photoGap: 11,
} as const;

/** Evening Trail notes and Home categories share the same card layout. */
export function NoteCard({
  name,caption,facts,titleAccessory,image,photo,index,divider,onPress,testID,accessibilityName,
  strip=false,elevated=false,compact=false,cardWidth=PHOTO_NOTE.width,
  tone='discovery',titleTestID='discover-listing-title',
}: {
  name:string;caption?:string;facts?:ReactNode;titleAccessory?:ReactNode;image?:string;photo?:ReactNode;index?:number;
  divider:boolean;onPress:()=>void;testID:string;accessibilityName?:string;
  strip?:boolean;elevated?:boolean;compact?:boolean;cardWidth?:number;
  tone?:'neutral'|'discovery';titleTestID?:string;
}) {
  const {width}=useWindowDimensions(),narrow=width<=360;
  const surface=useRaisedSurface(1,tone);
  const title=<Text testID={titleTestID} numberOfLines={compact?1:strip?3:undefined} className="font-fraunces text-ink"
    style={{fontSize:strip?17:18,lineHeight:strip?19.55:20.7,letterSpacing:-.2,...(titleAccessory?{flex:1,minWidth:0}:null)}}>{briefWords(name,5)}</Text>;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${accessibilityName||name}`} onPress={onPress} activeOpacity={.78} testID={testID}
    className={`items-start py-3.5 ${strip?'':`flex-row ${divider&&!elevated?'border-t border-edge-faint':''}`}`}
    style={[strip?{width:cardWidth,flexShrink:0}:{gap:12},elevated?{...surface,borderWidth:0,borderRadius:PHOTO_NOTE.radius,padding:PHOTO_NOTE.padding}:null]}>
    {elevated?<View pointerEvents="none" style={{position:'absolute',inset:0,borderRadius:12,borderWidth:1,borderColor:surface.borderColor}} />:null}
    {strip?(photo??(image?<Photo uri={image} radius={PHOTO_NOTE.photoRadius} style={{width:cardWidth-(elevated?PHOTO_NOTE.padding*2:0),height:PHOTO_NOTE.photoHeight,marginBottom:PHOTO_NOTE.photoGap}} />:null)):null}
    {index!==undefined?<Text accessible={false} numberOfLines={1} className="font-fraunces text-peach"
      style={{width:31,flexShrink:0,fontSize:23,lineHeight:25.3}}>{String(index+1).padStart(2,'0')}</Text>:null}
    <View className={`min-w-0 ${strip?'w-full':'flex-1'}`}>
      {titleAccessory?<View testID={`note-heading-${testID}`} className="w-full flex-row items-baseline gap-x-2">{title}{titleAccessory}</View>:title}
      {caption?<Text numberOfLines={compact?1:undefined} className="font-dm text-fine text-taupe" style={{marginTop:strip?5:7}}>{caption}</Text>:null}
      {facts?<View testID={`note-facts-${testID}`} className="flex-row" style={{marginTop:strip?8:11,flexWrap:compact?'nowrap':'wrap',columnGap:compact?8:11,rowGap:4}}>{facts}</View>:null}
    </View>
    {!strip&&image?<Photo uri={image} radius={9} style={{width:narrow?47:59,height:narrow?73:82}} />:null}
  </TouchableOpacity>;
}

function eventName(x:ScoperEvent):string {
  // Provider tour titles belong on the detail page. The canonical name still
  // labels the button for accessibility, search and navigation.
  return x.name.split(/:\s+|\s+-\s+|\s+w\/\s+/)[0];
}
function eventCaption(x:ScoperEvent):string {
  return x.vibeTags?.[0]||x.cats.find(c=>c!=='Tonight'&&c!=='Upcoming')||'Live event';
}
function shortVenue(x:ScoperEvent):string {
  if(x.venueId==='fox'||/^Fox Theater/i.test(x.venue))return 'Fox';
  if(x.venueId==='paramount'||/^Paramount Theatre/i.test(x.venue))return 'Paramount';
  return x.venue;
}

export function TrailLead({event:x,onPress}:{event:ScoperEvent;onPress:()=>void}) {
  const {width}=useWindowDimensions(),narrow=width<=360;
  const surface=useRaisedSurface(1,'discovery');
  const date=x.startsAt?new Date(x.startsAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Los_Angeles'}):eventDayGroupLabel(x);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}, ${date}, ${x.venue}`} onPress={onPress} activeOpacity={.78}
    testID="trail-lead" className="flex-row items-start" style={{...surface,borderWidth:0,gap:12,padding:12,borderRadius:12}}>
    <View pointerEvents="none" style={{position:'absolute',inset:0,borderRadius:12,borderWidth:1,borderColor:surface.borderColor}} />
    <View className="min-w-0 flex-1">
      <Text className="font-dm text-fine text-peach">{date}</Text>
      <Text testID="discover-listing-title" className="mt-[7px] font-fraunces text-ink" style={{fontSize:25,lineHeight:27,letterSpacing:-.7}}>{briefWords(eventName(x),5)}</Text>
      <Text className="mt-[7px] font-dm text-fine text-taupe">{eventCaption(x)}</Text>
      <Text testID="trail-lead-description" numberOfLines={1} className="mt-[7px] font-dm text-fine text-taupe">{heroDescription(x)}</Text>
      <View className="mt-[11px] flex-row flex-wrap" style={{columnGap:11,rowGap:4}}>
        <NoteFact glyph="pin" value={shortVenue(x)} label={x.venue} /><NoteFact glyph="clock" value={x.time} label={`${date}, ${x.time}`} />
      </View>
    </View>
    <Photo uri={x.image} radius={9} style={{width:narrow?65:78,height:narrow?96:114}} />
  </TouchableOpacity>;
}

export function ShowNote({event:x,onPress,cardWidth}:{event:ScoperEvent;onPress:()=>void;cardWidth?:number}) {
  return <NoteCard accessibilityName={x.name} name={eventName(x)} caption={eventCaption(x)} image={x.image} cardWidth={cardWidth} strip elevated compact divider={false} onPress={onPress} testID={`trail-show-${x.id}`}
    facts={<><NoteFact glyph="pin" value={shortVenue(x)} label={x.venue} compact flexible /><NoteFact glyph="clock" value={x.time} label={`${eventDayGroupLabel(x)}, ${x.time}`} compact /></>} />;
}

export function TableNote({restaurant:x,index,divider,onPress,strip=false,cardWidth}:{restaurant:Restaurant;index?:number;divider:boolean;onPress:()=>void;strip?:boolean;cardWidth?:number}) {
  return <NoteCard name={x.name} caption={x.cuisine==='American supper club'?'Supper club':x.cuisine} image={index===undefined?x.image:undefined} index={index}
    divider={divider} strip={strip} cardWidth={cardWidth} elevated onPress={onPress} testID={`trail-table-${x.id}`}
    facts={<><NoteFact glyph="wallet" value={x.price} label={`Price level ${x.price}`} /><NoteFact glyph={/ride/i.test(x.distanceLabel)?'car':/walk/i.test(x.distanceLabel)?'walk':'pin'} value={x.distanceLabel} /></>} />;
}

const NIGHT_NOTES:Record<string,[string,string,string]>={
  'bar-shiru':['Hi-fi listening bar','user','21+'],'little-bird':['Neighborhood cocktails','clock','2 AM'],
  crybaby:['Live music room','calendar','Shows'],'night-heron':['Music & art','clock','Hours'],
  penelope:['Cocktails & bites','clock','Hours'],'hello-stranger':['DJ bar','clock','Hours'],
};
export function BarNote({spot:x,onPress,cardWidth}:{spot:NightlifeSpot;onPress:()=>void;cardWidth?:number}) {
  const note=NIGHT_NOTES[x.id]||[x.kind,'clock','Hours'];
  const street=x.address.split(',')[0].replace(/^\d+\s+/,'');
  return <NoteCard name={x.name} caption={note[0]} image={x.image} cardWidth={cardWidth} strip elevated divider={false} onPress={onPress} testID={`trail-bar-${x.id}`}
    facts={<><NoteFact glyph="pin" value={street} label={x.address} /><NoteFact glyph={note[1]} value={note[2]} label={x.hours} /></>} />;
}

const ROUTE_CAPTIONS:Record<string,string>={oldoakland:'Piano bars to the waterfront.',uptown:'Cocktails, vinyl, a late finish.',downtown:'Cocktails, a lounge, a last bite.'};
export function RouteNote({route:x,index,divider,onPress}:{route:Crawl;index:number;divider:boolean;onPress:()=>void}) {
  const ride=/ride/i.test(x.meta),travel=ride?'Ride':x.meta.match(/(?:[<~]\s*)?[\d.]+\s*mi\b/)?.[0];
  return <NoteCard name={x.name} caption={ROUTE_CAPTIONS[x.id]||x.desc} index={index} divider={divider} elevated onPress={onPress} testID={`field-route-${x.id}`}
    facts={<><NoteFact glyph="route" value={`${x.stops.length} stops`} />{travel?<NoteFact glyph={ride?'car':'walk'} value={travel} label={x.meta} />:null}</>} />;
}

const ROOM_CAPTIONS:Record<string,string>={yoshis:'Live music & dining',fox:'1928 movie palace',paramount:'Art Deco theatre',elis:'Blues, food & drinks'};
export function RoomNote({venue:x,onPress,cardWidth}:{venue:Venue;onPress:()=>void;cardWidth?:number}) {
  const fact=x.detailFacts.find(f=>f.label==='Venue')?.value||x.sub1;
  const capacity=fact.match(/([\d,]+)-seat/i)?.[1]||fact.match(/capacity\s+(?:up to\s+)?([\d,]+)/i)?.[1];
  const primary=capacity||(/21\+/.test(fact)?'21+':/Art Deco/i.test(fact)?'Art Deco':null),travel=x.detailMeta.match(/(\d+)\s*min\s*(ride|walk)/i);
  return <NoteCard name={x.name} caption={ROOM_CAPTIONS[x.id]||x.sub1} image={x.image} cardWidth={cardWidth} strip elevated divider={false} onPress={onPress} testID={`field-room-${x.id}`}
    facts={<>{primary?<NoteFact glyph={capacity?'seat':primary==='21+'?'user':'landmark'} value={primary} label={fact} />:null}
      {travel?<NoteFact glyph={travel[2].toLowerCase()==='ride'?'car':'walk'} value={`${travel[1]} min`} label={travel[0]} />:null}</>} />;
}
