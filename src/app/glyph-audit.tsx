/** Branch-only visual verification of shared filled glyphs and legacy adapters. */
import { Text, View } from 'react-native';
import { Screen, ScreenScroll } from '@/components/layout';
import { Glyph } from '@/components/glyph';
import { Icon } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { useThemeColors } from '@/lib/theme';

const NAMES=["arrow","arrowUp","seat","landmark","logout","back","bell","bolt","briefcase","calendar","car","check","chevron","clock","close","compass","coffee","dollar","drink","film","filter","fitness","food","heart","hike","home","luggage","more","music","mic","plus","pin","refresh","route","search","shield","spark","sun","ticket","user","wallet","walk","star","trendUp","settings","help","qr","play","lock","lockOpen","chevronDown","chevronUp","edit"];
const LEGACY=["ticket","cutlery","martini","trendUp","heart","sparkles","luggage","card","gear","help","qr","play","compass","lock","lockOpen","microphone","clock","chevronDown","chevronUp","close","plus","refresh","edit","walk","arrowUp"] as (keyof typeof ICON_PATHS)[];
export default function GlyphAudit(){
  const colors=useThemeColors();
  return <Screen><ScreenScroll gap={16}>
    <Text className="font-fraunces text-title text-ink">Filled glyphs</Text>
    <View className="flex-row flex-wrap" style={{gap:8}}>
      {NAMES.map(name=><View key={name} testID={`glyph-case-${name}`} style={{width:72,height:56,alignItems:'center',justifyContent:'center',gap:5}}>
        <View className="flex-row items-center gap-x-3"><Glyph name={name} size={12} color={colors['fg-muted']} /><Glyph name={name} size={24} color={colors.fg} /></View>
        <Text numberOfLines={1} className="font-dm text-ink" style={{fontSize:9}}>{name}</Text>
      </View>)}
    </View>
    <Text className="font-fraunces text-section text-ink">Existing icon calls</Text>
    <View className="flex-row flex-wrap" style={{gap:8}}>
      {LEGACY.map(name=><View key={name} testID={`legacy-glyph-case-${name}`} style={{width:72,height:56,alignItems:'center',justifyContent:'center',gap:5}}>
        <View className="flex-row items-center gap-x-3"><Icon d={ICON_PATHS[name]} size={12} color={colors['fg-muted']} /><Icon d={ICON_PATHS[name]} size={24} color={colors.fg} /></View>
        <Text numberOfLines={1} className="font-dm text-ink" style={{fontSize:9}}>{name}</Text>
      </View>)}
    </View>
  </ScreenScroll></Screen>;
}
