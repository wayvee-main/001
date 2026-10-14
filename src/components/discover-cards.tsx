import { useState } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { eventDayGroupLabel, type NightlifeSpot, type Restaurant, type ScoperEvent } from '@/lib/data';
import { useThemeColors } from '@/lib/theme';

export function SmallFact({glyph,value,label}:{glyph:string;value:string;label?:string}) {
  const colors=useThemeColors();
  return <View accessibilityLabel={label||value} className="flex-row items-center gap-x-1">
    <Glyph name={glyph} size={12} color={colors['card-muted']} />
    <Text className="font-dm text-fine text-card-muted">{value}</Text>
  </View>;
}

function TableFacts({restaurant:x}:{restaurant:Restaurant}) {
  const distance=x.distanceLabel.replace(/\s+(walk|ride)$/i,'');
  const glyph=/ride/i.test(x.distanceLabel)?'car':/walk/i.test(x.distanceLabel)?'walk':'pin';
  return <View className="mt-1 flex-row flex-wrap items-center" style={{columnGap:8,rowGap:2}}>
    <Text accessibilityLabel={x.cuisine} className="font-dm text-fine text-card-muted">{x.cuisine==='American supper club'?'Supper club':x.cuisine}</Text>
    <SmallFact glyph="wallet" value={x.price} label={`Price level ${x.price}`} />
    <SmallFact glyph={glyph} value={distance} label={x.distanceLabel} />
  </View>;
}

function twoLineName(x:Restaurant,narrow:boolean):string {
  const names:Record<string,string>={
    cookfarmer:narrow?'The Cook and\nHer Farmer':'The Cook and Her\nFarmer',
    mua:'MUA\nOakland',bardo:'Bardo Lounge\n& Supper Club',farmhouse:'Farmhouse\nKitchen',
    gogi:'Gogi\nTime',parche:'Parche\n\u200b',
  };
  if(names[x.id])return names[x.id];
  const words=x.name.split(/\s+/),split=Math.ceil(words.length/2);
  return words.length>1?words.slice(0,split).join(' ')+'\n'+words.slice(split).join(' '):x.name+'\n\u200b';
}

export function MenuSlip({restaurant:x,width,onPress}:{restaurant:Restaurant;width:number;onPress:()=>void}) {
  const narrow=width<280;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}`} onPress={onPress} activeOpacity={.78}
    className="flex-row items-center bg-surface" style={{width,height:narrow?86.84:96,paddingHorizontal:narrow?12:14,paddingVertical:narrow?7:8,gap:narrow?10:12,borderRadius:13}}>
    <View className="min-w-0 flex-1">
      <Text accessibilityLabel={x.name} numberOfLines={2} className="font-fraunces text-table-name text-card-ink" style={{height:40.32}}>{twoLineName(x,narrow)}</Text>
      <TableFacts restaurant={x} />
    </View>
    <Photo uri={x.image} radius={9} style={{width:narrow?64:74,height:narrow?67.2:73.6}} />
  </TouchableOpacity>;
}

export function MoreTable({restaurant:x,onPress}:{restaurant:Restaurant;onPress:()=>void}) {
  const {width}=useWindowDimensions(),narrow=width<=360;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}`} onPress={onPress} activeOpacity={.78}
    className="flex-row items-center bg-surface" style={{padding:10,gap:narrow?9:11,borderRadius:13}}>
    <Photo uri={x.image} radius={9} style={{width:narrow?46:54,height:narrow?46:54}} />
    <View className="min-w-0 flex-1"><Text className="font-dm-medium text-card-name text-card-ink">{x.name}</Text><TableFacts restaurant={x} /></View>
  </TouchableOpacity>;
}

const NIGHT_NOTES:Record<string,[string,string,string]>={
  'bar-shiru':['Hi-fi listening bar','user','21+'],
  'little-bird':['Neighborhood cocktails','clock','2 AM'],
  crybaby:['Live music room','calendar','Shows'],
  'night-heron':['Music & art','clock','Hours'],penelope:['Cocktails & bites','clock','Hours'],
  'hello-stranger':['DJ bar','clock','Hours'],'athletic-club':['Sports bar','clock','Hours'],
  arbor:['Craft beer taproom','clock','Hours'],'drakes-dealership':['Beer garden','clock','Hours'],
  'make-westing':['Cocktails & bocce','clock','Hours'],
};

export function EssentialNight({spot:x,onPress}:{spot:NightlifeSpot;onPress:()=>void}) {
  const {width}=useWindowDimensions();
  const note=NIGHT_NOTES[x.id]||[x.kind.split(/\s+/).slice(0,3).join(' '),'clock','Hours'];
  const street=x.address.split(',')[0].replace(/^\d+\s+/,'').replace(/\s+(Ave|Avenue)\.?$/,'');
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}`} onPress={onPress} activeOpacity={.78}
    className="overflow-hidden rounded-card bg-surface" style={{width:width<=400?149:157,alignSelf:'flex-start'}}>
    <Photo uri={x.image} radius={0} style={{width:'100%',height:111}} />
    <View style={{paddingHorizontal:11,paddingTop:10,paddingBottom:12}}>
      <Text numberOfLines={2} className="font-dm-medium text-card-name text-card-ink">{x.name}</Text>
      <Text numberOfLines={1} className="mt-[5px] font-dm text-fine text-card-muted">{note[0]}</Text>
      <View className="mt-[9px] flex-row flex-wrap items-center justify-between" style={{gap:4}}>
        <SmallFact glyph="pin" value={street} label={x.address} /><SmallFact glyph={note[1]} value={note[2]} label={x.hours} />
      </View>
    </View>
  </TouchableOpacity>;
}

function eventCaption(x:ScoperEvent):string {
  const known:Record<string,string>={brandonFlowers:'The Killers frontman',thieveryCorporation:'Electronic & dub',poppy:'Constantly Nowhere Tour'};
  return known[x.id]||(x.vibeTags?.[0]||x.cats[0]||'Live music').split(/\s+/).slice(0,3).join(' ');
}

export function EssentialEvent({event:x,onPress}:{event:ScoperEvent;onPress:()=>void}) {
  const {width}=useWindowDimensions();
  const [bodyHeight,setBodyHeight]=useState(100);
  // Reduce the entire containment by 10%, preserving text/glyph sizes and
  // allowing real names and metadata to wrap. The photo absorbs the reduction.
  const artHeight=Math.max(56,(111+bodyHeight)*.9-bodyHeight);
  const shortVenue=x.venue==='Fox Theater'?'Fox':x.venue==='Paramount Theatre'?'Paramount':x.venue;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name} at ${x.venue}`} onPress={onPress} activeOpacity={.78}
    className="overflow-hidden rounded-card bg-surface" style={{width:width<=400?149:157,alignSelf:'flex-start'}}>
    <Photo uri={x.image} radius={0} style={{width:'100%',height:artHeight}} />
    <View onLayout={e=>setBodyHeight(e.nativeEvent.layout.height)} style={{paddingHorizontal:11,paddingTop:10,paddingBottom:12}}>
      <Text numberOfLines={2} className="font-dm-medium text-card-name text-card-ink">{x.name}</Text>
      <Text numberOfLines={1} className="mt-[5px] font-dm text-fine text-card-muted">{eventCaption(x)}</Text>
      <View className="mt-[9px] flex-row flex-wrap items-center justify-between" style={{gap:4}}>
        <SmallFact glyph="pin" value={shortVenue} label={x.venue} /><SmallFact glyph="clock" value={x.time} />
      </View>
    </View>
  </TouchableOpacity>;
}

export function StageHero({event:x,onPress}:{event:ScoperEvent;onPress:()=>void}) {
  const {width}=useWindowDimensions(),colors=useThemeColors();
  const [bodyHeight,setBodyHeight]=useState(156);
  const originalArt=width<=360?128.08:144.28;
  const artHeight=Math.max(64,(originalArt+bodyHeight)*.85-bodyHeight);
  const date=x.startsAt?new Date(x.startsAt):null;
  const doors=x.date.match(/\bDoors\s+([^·]+)/i)?.[1]?.trim();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Explore ${x.name}, ${eventDayGroupLabel(x)}, ${x.venue}`} onPress={onPress} activeOpacity={.8}
    className="overflow-hidden rounded-card bg-surface">
    <View><Photo uri={x.image} radius={0} style={{width:'100%',height:artHeight}} />
      {date?<View className="absolute left-3 top-3 rounded-control bg-surface px-2.5 py-2">
        <Text className="text-center font-dm text-fine text-card-muted">{date.toLocaleDateString('en-US',{month:'short',timeZone:'America/Los_Angeles'})}</Text>
        <Text className="text-center font-fraunces text-title text-card-ink">{date.toLocaleDateString('en-US',{day:'numeric',timeZone:'America/Los_Angeles'})}</Text>
      </View>:null}</View>
    <View onLayout={e=>setBodyHeight(e.nativeEvent.layout.height)} style={{padding:14,gap:7}}>
      <Text numberOfLines={1} className="font-dm text-fine text-card-muted">{[eventCaption(x),x.ticketed?'Official tickets':x.priceLabel].filter(Boolean).join(' · ')}</Text>
      <Text numberOfLines={2} className="font-fraunces text-card-ink" style={{fontSize:25,lineHeight:28}}>{x.name}</Text>
      <View className="flex-row flex-wrap items-center justify-between" style={{gap:6}}><SmallFact glyph="pin" value={x.venue} /><SmallFact glyph={/ride/i.test(x.travel)?'car':'walk'} value={x.travel} /></View>
      <View className="flex-row items-center justify-between border-t border-edge-soft pt-2">
        <View className="flex-row flex-wrap" style={{gap:10}}>{doors?<SmallFact glyph="clock" value={`Doors ${doors}`} />:null}<SmallFact glyph="music" value={`Show ${x.time}`} /></View>
        <Glyph name="arrow" size={16} color={colors['card-ink']} />
      </View>
    </View>
  </TouchableOpacity>;
}
