import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { eventDayGroupLabel, type Crawl, type NightlifeSpot, type Restaurant, type ScoperEvent, type Venue } from '@/lib/data';
import { useThemeColors } from '@/lib/theme';

function Fact({glyph,value,label}:{glyph:string;value:string;label?:string}) {
  const colors=useThemeColors();
  return <View accessibilityLabel={label||value} className="flex-row items-center gap-x-1">
    <Glyph name={glyph} size={12} color={colors['fg-muted']} />
    <Text className="font-dm text-fine text-taupe">{value}</Text>
  </View>;
}

/** Evening Trail notes and photo strips share the original detail routes. */
function Note({name,caption,facts,image,index,divider,onPress,testID,accessibilityName,strip=false}:{name:string;caption:string;facts:ReactNode;image?:string;index?:number;divider:boolean;onPress:()=>void;testID:string;accessibilityName?:string;strip?:boolean}) {
  const {width}=useWindowDimensions(),narrow=width<=360;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${accessibilityName||name}`} onPress={onPress} activeOpacity={.78} testID={testID}
    className={`items-start py-3.5 ${strip?'':`flex-row ${divider?'border-t border-edge-soft':''}`}`} style={strip?{width:137,flexShrink:0}:{gap:12}}>
    {strip&&image?<Photo uri={image} radius={8} style={{width:137,height:73,marginBottom:11}} />:null}
    {index!==undefined?<Text accessible={false} numberOfLines={1} className="font-fraunces text-peach"
      style={{width:31,flexShrink:0,fontSize:23,lineHeight:25.3}}>{String(index+1).padStart(2,'0')}</Text>:null}
    <View className={`min-w-0 ${strip?'w-full':'flex-1'}`}>
      <Text numberOfLines={strip?3:undefined} className="font-fraunces text-ink" style={{fontSize:strip?17:18,lineHeight:strip?19.55:20.7,letterSpacing:-.2}}>{name}</Text>
      <Text className="font-dm text-fine text-taupe" style={{marginTop:strip?5:7}}>{caption}</Text>
      <View className="flex-row flex-wrap" style={{marginTop:strip?8:11,columnGap:11,rowGap:4}}>{facts}</View>
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
  const date=x.startsAt?new Date(x.startsAt).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/Los_Angeles'}):eventDayGroupLabel(x);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}, ${date}, ${x.venue}`} onPress={onPress} activeOpacity={.78}
    testID="trail-lead" className="flex-row items-start pt-2.5 pb-4" style={{gap:12}}>
    <View className="min-w-0 flex-1">
      <Text className="font-dm text-fine text-peach">{date}</Text>
      <Text className="mt-[7px] font-fraunces text-ink" style={{fontSize:25,lineHeight:27,letterSpacing:-.7}}>{eventName(x)}</Text>
      <Text className="mt-[7px] font-dm text-fine text-taupe">{eventCaption(x)}</Text>
      <View className="mt-[11px] flex-row flex-wrap" style={{columnGap:11,rowGap:4}}>
        <Fact glyph="pin" value={shortVenue(x)} label={x.venue} /><Fact glyph="clock" value={x.time} label={`${date}, ${x.time}`} />
      </View>
    </View>
    <Photo uri={x.image} radius={9} style={{width:narrow?65:78,height:narrow?96:114}} />
  </TouchableOpacity>;
}

export function ShowNote({event:x,onPress}:{event:ScoperEvent;onPress:()=>void}) {
  return <Note accessibilityName={x.name} name={eventName(x)} caption={eventCaption(x)} image={x.image} strip divider={false} onPress={onPress} testID={`trail-show-${x.id}`}
    facts={<><Fact glyph="pin" value={shortVenue(x)} label={x.venue} /><Fact glyph="clock" value={x.time} label={`${eventDayGroupLabel(x)}, ${x.time}`} /></>} />;
}

export function TableNote({restaurant:x,index,divider,onPress}:{restaurant:Restaurant;index?:number;divider:boolean;onPress:()=>void}) {
  return <Note name={x.name} caption={x.cuisine==='American supper club'?'Supper club':x.cuisine} image={index===undefined?x.image:undefined} index={index}
    divider={divider} onPress={onPress} testID={`trail-table-${x.id}`}
    facts={<><Fact glyph="wallet" value={x.price} label={`Price level ${x.price}`} /><Fact glyph={/ride/i.test(x.distanceLabel)?'car':/walk/i.test(x.distanceLabel)?'walk':'pin'} value={x.distanceLabel} /></>} />;
}

const NIGHT_NOTES:Record<string,[string,string,string]>={
  'bar-shiru':['Hi-fi listening bar','user','21+'],'little-bird':['Neighborhood cocktails','clock','2 AM'],
  crybaby:['Live music room','calendar','Shows'],'night-heron':['Music & art','clock','Hours'],
  penelope:['Cocktails & bites','clock','Hours'],'hello-stranger':['DJ bar','clock','Hours'],
};
export function BarNote({spot:x,onPress}:{spot:NightlifeSpot;onPress:()=>void}) {
  const note=NIGHT_NOTES[x.id]||[x.kind,'clock','Hours'];
  const street=x.address.split(',')[0].replace(/^\d+\s+/,'');
  return <Note name={x.name} caption={note[0]} image={x.image} strip divider={false} onPress={onPress} testID={`trail-bar-${x.id}`}
    facts={<><Fact glyph="pin" value={street} label={x.address} /><Fact glyph={note[1]} value={note[2]} label={x.hours} /></>} />;
}

const ROUTE_CAPTIONS:Record<string,string>={oldoakland:'Piano bars to the waterfront.',uptown:'Cocktails, vinyl, a late finish.',downtown:'Cocktails, a lounge, a last bite.'};
export function RouteNote({route:x,index,divider,onPress}:{route:Crawl;index:number;divider:boolean;onPress:()=>void}) {
  const ride=/ride/i.test(x.meta),travel=ride?'Ride':x.meta.match(/(?:[<~]\s*)?[\d.]+\s*mi\b/)?.[0];
  return <Note name={x.name} caption={ROUTE_CAPTIONS[x.id]||x.desc} index={index} divider={divider} onPress={onPress} testID={`field-route-${x.id}`}
    facts={<><Fact glyph="route" value={`${x.stops.length} stops`} />{travel?<Fact glyph={ride?'car':'walk'} value={travel} label={x.meta} />:null}</>} />;
}

const ROOM_CAPTIONS:Record<string,string>={yoshis:'Live music & dining',fox:'1928 movie palace',paramount:'Art Deco theatre',elis:'Blues, food & drinks'};
export function RoomNote({venue:x,divider,onPress}:{venue:Venue;divider:boolean;onPress:()=>void}) {
  const fact=x.detailFacts.find(f=>f.label==='Venue')?.value||x.sub1;
  const capacity=fact.match(/([\d,]+)-seat/i)?.[1]||fact.match(/capacity\s+(?:up to\s+)?([\d,]+)/i)?.[1];
  const primary=capacity||(/21\+/.test(fact)?'21+':/Art Deco/i.test(fact)?'Art Deco':null),travel=x.detailMeta.match(/(\d+)\s*min\s*(ride|walk)/i);
  return <Note name={x.name} caption={ROOM_CAPTIONS[x.id]||x.sub1} image={x.image} divider={divider} onPress={onPress} testID={`field-room-${x.id}`}
    facts={<>{primary?<Fact glyph={capacity?'seat':primary==='21+'?'user':'landmark'} value={primary} label={fact} />:null}
      {travel?<Fact glyph={travel[2].toLowerCase()==='ride'?'car':'walk'} value={`${travel[1]} min`} label={travel[0]} />:null}</>} />;
}
