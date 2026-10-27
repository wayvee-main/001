import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { RaisedTouchable } from '@/components/raised-surface';
import { homeGuideHref, type HomeGuideEntry } from '@/lib/home-guide';
import { HOME_RESULT, homeEntryMetadata, shortHomeTitle } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

/** These exact dimensions apply to Eat, Bars, Routes and Events alike. */
export function HomeResultCard({entry,borderless=false}:{entry:HomeGuideEntry;borderless?:boolean}) {
  const router=useRouter(),colors=useThemeColors(),meta=homeEntryMetadata(entry);
  return <RaisedTouchable testID="home-result-card" accessibilityRole="button" accessibilityLabel={[entry.name,meta.primary,meta.secondary].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.76}
    style={[borderless?{backgroundColor:colors['surface-control'],borderWidth:0}:undefined,{height:HOME_RESULT.height,borderRadius:HOME_RESULT.radius,padding:HOME_RESULT.inset,flexDirection:'row',alignItems:'center',gap:HOME_RESULT.textGap,overflow:'hidden'}]}>
    <View testID="home-result-thumbnail" style={{width:HOME_RESULT.thumbnailWidth,height:HOME_RESULT.thumbnailHeight,flexShrink:0}}>
      <Photo uri={entry.detailContent?.photos?.[0]?.url||entry.image} radius={9} stripedPlaceholder={!borderless} fallbackGlyph={entry.glyph} fallbackLabel={`Photo unavailable for ${entry.name}`} style={[{width:'100%',height:'100%'},borderless?{borderWidth:0}:undefined]} />
    </View>
    <View style={{flex:1,minWidth:0,gap:3}}>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink" style={{fontSize:17,lineHeight:20,letterSpacing:-.25}}>{shortHomeTitle(entry.name)}</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-taupe" style={{fontSize:11,lineHeight:13}}>{meta.primary}</Text>
      {meta.secondary?<Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-taupe" style={{fontSize:11,lineHeight:13}}>{meta.secondary}</Text>:null}
    </View>
    <Glyph name="chevron" size={15} color={colors['surface-accent']} />
  </RaisedTouchable>;
}
