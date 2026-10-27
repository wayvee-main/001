import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { homeGuideHref, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import type { HomeIndexPhoto } from '@/lib/home-index-photos';
import { homeOpenLedgerContent } from '@/lib/home-ledger';
import { shortHomeTitle } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

/** The approved Open Ledger geometry, shared by all four tile destinations. */
export const HOME_INDEX = {height:122,firstHeight:108,mediaWidth:89,mediaHeight:89,gap:0} as const;

function IndexPhoto({photos,onUnavailable}: {photos:readonly HomeIndexPhoto[];onUnavailable:()=>void}) {
  const [index,setIndex]=useState(0),photo=photos[index];
  if(!photo)return null;
  return <Image key={String(photo.source)} testID="home-index-photo" accessibilityLabel={photo.label}
    source={typeof photo.source==='string'?{uri:photo.source}:photo.source} contentFit="cover" cachePolicy="memory-disk" transition={150}
    style={{width:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,borderRadius:11}}
    onError={()=>{if(index+1<photos.length)setIndex(index+1);else onUnavailable();}} />;
}

export function HomeIndexRow({entry,category,index,photos,onPhotoUnavailable}:{entry:HomeGuideEntry;category:HomeGuideCategory;index:number;photos:readonly HomeIndexPhoto[];onPhotoUnavailable:()=>void}) {
  const router=useRouter(),colors=useThemeColors(),{caption,facts}=homeOpenLedgerContent(entry,category);
  return <TouchableOpacity testID="home-index-row" accessibilityRole="button" accessibilityLabel={[entry.name,caption,...facts.map(fact=>fact.label||fact.value)].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.73}
    style={{minHeight:index===0?HOME_INDEX.firstHeight:HOME_INDEX.height,flexDirection:'row',alignItems:'center',gap:15,paddingTop:index===0?0:15,paddingBottom:15,borderBottomWidth:1,borderBottomColor:colors['edge-soft']}}>
    <View style={{flex:1,minWidth:0}}>
      <Text numberOfLines={2} ellipsizeMode="tail" className="font-fraunces text-ink" style={{fontSize:22,lineHeight:25,letterSpacing:-.3,marginBottom:6}}>{shortHomeTitle(entry.name)}</Text>
      {caption?<Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{lineHeight:15,marginBottom:8}}>{caption}</Text>:null}
      <View testID="home-ledger-row-facts" style={{flexDirection:'row',alignItems:'center',gap:6,minHeight:16}}>
        <View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8}}>{facts.map((fact,factIndex)=><View key={factIndex} accessibilityLabel={fact.label||fact.value} style={{flexDirection:'row',alignItems:'center',gap:4,minWidth:0,flexShrink:1}}>
          {!['wallet','dollar'].includes(fact.glyph)?<Glyph name={fact.glyph} size={12} color={colors['surface-accent']} />:null}
          <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{lineHeight:16,flexShrink:1}}>{fact.value}</Text>
        </View>)}</View>
        <Glyph name="chevron" size={15} color={colors['surface-accent']} />
      </View>
    </View>
    <View testID="home-index-media" style={{width:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,flexShrink:0}}>
      <IndexPhoto photos={photos} onUnavailable={onPhotoUnavailable} />
    </View>
  </TouchableOpacity>;
}
