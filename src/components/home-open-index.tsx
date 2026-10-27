import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { homeGuideHref, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { homeEntryMetadata, homeMenuItems, shortHomeTitle } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

/** B4 has one open row geometry across all four destinations. */
export const HOME_INDEX = {height:108,mediaWidth:112,mediaHeight:84,gap:10} as const;

export function HomeIndexRow({entry,category,index}:{entry:HomeGuideEntry;category:HomeGuideCategory;index:number}) {
  const router=useRouter(),colors=useThemeColors(),meta=homeEntryMetadata(entry),menu=homeMenuItems(entry);
  const address=entry.details.find(fact=>fact.label==='Address')?.value.split(',')[0];
  const offer=entry.detailContent?.offers?.[0],numbered=category==='routes';
  const first=category==='events'?entry.caption:category==='eat'&&!offer?address||entry.caption:meta.primary;
  const second=category==='events'&&entry.kind==='event'?meta.primary:category==='eat'&&menu.length&&!offer?`${menu.length} menu items`:meta.secondary;
  const image=entry.detailContent?.photos?.[0]?.url||entry.image||menu.find(item=>item.image)?.image;
  return <TouchableOpacity testID="home-index-row" accessibilityRole="button" accessibilityLabel={[String(index+1),entry.name,first,second].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.73}
    style={{height:HOME_INDEX.height,flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12}}>
    <View testID="home-index-media" style={{width:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,flexDirection:'row',alignItems:'center',gap:6,flexShrink:0}}>
      {numbered?<View testID="home-index-number" style={{width:22,height:22,borderRadius:11,alignSelf:'flex-start',marginTop:8,alignItems:'center',justifyContent:'center',backgroundColor:colors['home-tile-well']}}>
        <Text className="font-dm-medium text-fine text-ink">{index+1}</Text>
      </View>:null}
      <Photo uri={image} radius={8} stripedPlaceholder={false} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`}
        style={{width:numbered?84:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,borderWidth:0}} />
    </View>
    <View style={{flex:1,minWidth:0,gap:4}}>
      <Text numberOfLines={2} ellipsizeMode="tail" className="font-fraunces text-ink" style={{fontSize:19,lineHeight:23,letterSpacing:-.35}}>{shortHomeTitle(entry.name)}</Text>
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
