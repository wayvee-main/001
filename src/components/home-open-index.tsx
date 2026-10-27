import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { homeGuideHref, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import type { HomeIndexPhoto } from '@/lib/home-index-photos';
import { homeEntryMetadata, homeMenuItems, shortHomeTitle } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

/** B4 has one open row geometry across all four destinations. */
export const HOME_INDEX = {height:86.4,mediaWidth:89.6,mediaHeight:67.2,gap:10} as const;

function IndexPhoto({photos,numbered,onUnavailable}: {photos:readonly HomeIndexPhoto[];numbered:boolean;onUnavailable:()=>void}) {
  const [index,setIndex]=useState(0),photo=photos[index];
  if(!photo)return null;
  return <Image key={String(photo.source)} testID="home-index-photo" accessibilityLabel={photo.label}
    source={typeof photo.source==='string'?{uri:photo.source}:photo.source} contentFit="cover" cachePolicy="memory-disk" transition={150}
    style={{width:numbered?HOME_INDEX.mediaHeight:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,borderRadius:8}}
    onError={()=>{if(index+1<photos.length)setIndex(index+1);else onUnavailable();}} />;
}

export function HomeIndexRow({entry,category,index,photos,onPhotoUnavailable}:{entry:HomeGuideEntry;category:HomeGuideCategory;index:number;photos:readonly HomeIndexPhoto[];onPhotoUnavailable:()=>void}) {
  const router=useRouter(),colors=useThemeColors(),meta=homeEntryMetadata(entry),menu=homeMenuItems(entry);
  const address=entry.details.find(fact=>fact.label==='Address')?.value.split(',')[0];
  const offer=entry.detailContent?.offers?.[0],numbered=category==='routes';
  const first=category==='events'?entry.caption:category==='eat'&&!offer?address||entry.caption:meta.primary;
  const second=category==='events'&&entry.kind==='event'?meta.primary:category==='eat'&&menu.length&&!offer?`${menu.length} menu items`:meta.secondary;
  return <TouchableOpacity testID="home-index-row" accessibilityRole="button" accessibilityLabel={[String(index+1),entry.name,first,second].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.73}
    style={{height:HOME_INDEX.height,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9.6}}>
    <View testID="home-index-media" style={{width:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,flexDirection:'row',alignItems:'center',gap:4.8,flexShrink:0}}>
      {numbered?<View testID="home-index-number" style={{width:17.6,height:17.6,borderRadius:8.8,alignSelf:'flex-start',marginTop:6.4,alignItems:'center',justifyContent:'center',backgroundColor:colors['home-tile-well']}}>
        <Text className="font-dm-medium text-ink" style={{fontSize:10,lineHeight:12}}>{index+1}</Text>
      </View>:null}
      <IndexPhoto photos={photos} numbered={numbered} onUnavailable={onPhotoUnavailable} />
    </View>
    <View style={{flex:1,minWidth:0,gap:3}}>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink" style={{fontSize:19,lineHeight:23,letterSpacing:-.35}}>{shortHomeTitle(entry.name)}</Text>
      {first?<Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{lineHeight:15}}>{first}</Text>:null}
      {second&&second!==first?<View style={{flexDirection:'row',alignItems:'center',gap:5,minWidth:0}}>
        {category==='events'?<Glyph name={entry.kind==='event'?'calendar':'landmark'} size={12} color={colors['surface-accent']} />:null}
        <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{lineHeight:15,flexShrink:1}}>{second}</Text>
      </View>:null}
    </View>
    <Glyph name="chevron" size={15} color={colors['surface-accent']} />
    <View testID="home-index-rule" pointerEvents="none" style={{position:'absolute',bottom:0,left:0,right:0,height:.5,backgroundColor:colors['edge-soft']}} />
  </TouchableOpacity>;
}
