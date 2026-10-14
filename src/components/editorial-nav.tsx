import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { useAppGutter } from '@/components/layout';
import { VeeMark } from '@/components/vee-mark';
import { useElevation } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

export interface NavigationItem {
  key: string;
  label: string;
  glyph: string;
  selected: boolean;
  onPress: () => void;
}

/** One floating pill treatment for tabs and the detail-screen navigation. */
export function EditorialNav({items,reserveSpace=false}:{items:NavigationItem[];reserveSpace?:boolean}) {
  const colors=useThemeColors(),insets=useSafeAreaInsets(),gutter=useAppGutter(),lift=useElevation(4);
  const bottom=insets.bottom+18;
  return <View pointerEvents="box-none" style={reserveSpace?{height:bottom+76}:{position:'absolute',left:0,right:0,bottom:0,height:bottom+76}}>
    <View testID="editorial-navigation" className="flex-row items-center rounded-full" style={[lift,{position:'absolute',left:gutter,right:gutter,bottom,
      backgroundColor:colors['selected-surface'],paddingTop:10,paddingBottom:9,paddingHorizontal:12}]}>
      {items.map(x=><TouchableOpacity key={x.key} accessibilityRole="tab" accessibilityState={{selected:x.selected}} accessibilityLabel={x.label}
        onPress={x.onPress} activeOpacity={.7} className="min-w-0 flex-1 items-center gap-y-[3px]" style={{minHeight:44}}>
        <View className="h-7 w-7 items-center justify-center rounded-full" style={{backgroundColor:x.selected&&x.key!=='create'?'rgba(255,255,255,.14)':'transparent'}}>
          {x.key==='create'?<VeeMark size={26} variant="compact" color={x.selected?colors['selected-glyph']:colors['vee-strong']} />:
            <Glyph name={x.glyph} size={18} color={x.selected?colors['on-selected']:colors['navigation-muted']} strokeWidth={1.7} />}
        </View>
        <Text numberOfLines={1} className={x.selected?'font-dm-medium':'font-dm'} style={{fontSize:11,lineHeight:15,
          color:x.selected||x.key==='create'?colors['on-selected']:colors['navigation-muted']}}>{x.label}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}
