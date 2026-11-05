import { CardMetadata } from '@/components/card-metadata';
import { metadataFact } from '@/lib/card-metadata';
import { MetadataLine } from '@/components/metadata-pill';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { homeGuideHref, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import type { HomeIndexPhoto } from '@/lib/home-index-photos';
import { homeOpenLedgerContent } from '@/lib/home-ledger';
import { shortHomeTitle } from '@/lib/home-secondary';
import { useThemeColors } from '@/lib/theme';

/** The approved Open Ledger geometry, shared by all four tile destinations. */
export const HOME_INDEX = {height:122,firstHeight:108,mediaWidth:89,mediaHeight:89,gap:0} as const;

function IndexPhoto({photos,onUnavailable}: {photos:readonly HomeIndexPhoto[];onUnavailable:()=>void}) {
  return <Photo candidates={photos} onUnavailable={onUnavailable} fallbackLabel="Photo unavailable" radius={11} stripedPlaceholder={false}
    style={{width:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight}} />;
}

export function HomeIndexRow({entry,category,index,photos,onPhotoUnavailable}:{entry:HomeGuideEntry;category:HomeGuideCategory;index:number;photos:readonly HomeIndexPhoto[];onPhotoUnavailable:()=>void}) {
  const router=useRouter(),colors=useThemeColors(),{caption,facts}=homeOpenLedgerContent(entry,category);
  return <TouchableOpacity testID="home-index-row" accessibilityRole="button" accessibilityLabel={[entry.name,caption,...facts.map(fact=>fact.label||fact.value)].filter(Boolean).join('. ')}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.73}
    style={{minHeight:index===0?HOME_INDEX.firstHeight:HOME_INDEX.height,flexDirection:'row',alignItems:'center',gap:15,paddingTop:index===0?0:15,paddingBottom:15,borderBottomWidth:1,borderBottomColor:colors['edge-soft']}}>
    <View style={{flex:1,minWidth:0}}>
      <Text numberOfLines={2} ellipsizeMode="tail" className="font-fraunces text-ink" style={{fontSize:22,lineHeight:25,letterSpacing:-.3,marginBottom:6}}>{shortHomeTitle(entry.name)}</Text>
      {caption?<View style={{marginBottom:8}}><MetadataLine text={caption} /></View>:null}
      <View testID="home-ledger-row-facts" style={{flexDirection:'row',alignItems:'center',gap:6,minHeight:16}}>
        <View style={{flex:1,minWidth:0}}><CardMetadata items={facts.map(metadataFact)} compact /></View>
        <Glyph name="chevron" size={15} color={colors['surface-accent']} />
      </View>
    </View>
    <View testID="home-index-media" style={{width:HOME_INDEX.mediaWidth,height:HOME_INDEX.mediaHeight,flexShrink:0}}>
      <IndexPhoto photos={photos} onUnavailable={onPhotoUnavailable} />
    </View>
  </TouchableOpacity>;
}
