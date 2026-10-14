import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Photo } from '@/components/photo';
import { SmallFact } from '@/components/discover-cards';
import type { Crawl, Venue } from '@/lib/data';

const ROUTE_CAPTIONS: Record<string, string> = {
  oldoakland: 'Piano bars to the waterfront.',
  uptown: 'Cocktails, vinyl, a late finish.',
  downtown: 'Cocktails, a lounge, a last bite.',
};
const ROOM_CAPTIONS: Record<string, string> = {
  yoshis: 'Live music & dining', fox: '1928 movie palace',
  paramount: 'Art Deco theatre', elis: 'Blues, food & drinks',
};

/** Numbered, uncontained rows from the approved Field Notes selector. Full
 * descriptions, addresses and stop lists remain on the existing detail pages. */
export function RouteNote({route:x,index,divider,onPress}:{route:Crawl;index:number;divider:boolean;onPress:()=>void}) {
  const {width}=useWindowDimensions();
  const ride=/ride/i.test(x.meta);
  const travel=ride?'Ride':x.meta.match(/(?:[<~]\s*)?[\d.]+\s*mi\b/)?.[0];
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}`} onPress={onPress} activeOpacity={.78}
    testID={`field-route-${x.id}`} className={`flex-row items-start py-3.5 ${divider?'border-t border-edge-soft':''}`} style={{gap:width<=360?9:12}}>
    <Text accessible={false} numberOfLines={1} className="font-fraunces text-peach" style={{width:width<=360?34:36,flexShrink:0,fontSize:width<=360?24:26,lineHeight:29,fontVariant:['tabular-nums']}}>{String(index+1).padStart(2,'0')}</Text>
    <View className="min-w-0 flex-1">
      <Text className="font-fraunces text-card-ink" style={{fontSize:18,lineHeight:20.52}}>{x.name}</Text>
      <Text className="mt-[7px] font-dm text-fine text-card-muted">{ROUTE_CAPTIONS[x.id]||x.desc}</Text>
      <View className="mt-[11px] flex-row flex-wrap" style={{columnGap:12,rowGap:4}}>
        <SmallFact glyph="route" value={`${x.stops.length} stops`} />
        {travel?<SmallFact glyph={ride?'car':'walk'} value={travel} label={x.meta} />:null}
      </View>
    </View>
  </TouchableOpacity>;
}

export function RoomNote({venue:x,divider,onPress}:{venue:Venue;divider:boolean;onPress:()=>void}) {
  const {width}=useWindowDimensions(),narrow=width<=360;
  const fact=x.detailFacts.find(f=>f.label==='Venue')?.value||x.sub1;
  const capacity=fact.match(/([\d,]+)-seat/i)?.[1]||fact.match(/capacity\s+(?:up to\s+)?([\d,]+)/i)?.[1];
  const primary=capacity||(/21\+/.test(fact)?'21+':/Art Deco/i.test(fact)?'Art Deco':null);
  const travel=x.detailMeta.match(/(\d+)\s*min\s*(ride|walk)/i);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}`} onPress={onPress} activeOpacity={.78}
    testID={`field-room-${x.id}`} className={`flex-row items-start py-3.5 ${divider?'border-t border-edge-soft':''}`} style={{gap:narrow?9:12}}>
    <View className="min-w-0 flex-1">
      <Text className="font-fraunces text-card-ink" style={{fontSize:18,lineHeight:20.52}}>{x.name}</Text>
      <Text className="mt-[7px] font-dm text-fine text-card-muted">{ROOM_CAPTIONS[x.id]||x.sub1}</Text>
      <View className="mt-[11px] flex-row flex-wrap" style={{columnGap:12,rowGap:4}}>
        {primary?<SmallFact glyph={capacity?'seat':primary==='21+'?'user':'landmark'} value={primary} label={fact} />:null}
        {travel?<SmallFact glyph={travel[2].toLowerCase()==='ride'?'car':'walk'} value={`${travel[1]} min`} label={travel[0]} />:null}
      </View>
    </View>
    <Photo uri={x.image} radius={9} style={{width:narrow?47:59,height:narrow?80:82}} />
  </TouchableOpacity>;
}
