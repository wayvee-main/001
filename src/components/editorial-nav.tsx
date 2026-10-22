import { useEffect, useState } from 'react';
import { useColorScheme } from 'nativewind';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { useAppGutter } from '@/components/layout';
import { VeeMark } from '@/components/vee-mark';
import { useReducedMotionPreference } from '@/lib/motion';
import { navHidden } from '@/lib/nav-visibility';
import { useThemeColors } from '@/lib/theme';
import { withAlpha } from '@/lib/tokens';

export interface NavigationItem {
  key: string;
  label: string;
  glyph: string;
  selected: boolean;
  onPress: () => void;
}

function EditorialTab({item,reduceMotion}:{item:NavigationItem;reduceMotion:boolean}) {
  const colors=useThemeColors();
  const [selection]=useState(()=>new Animated.Value(item.selected?1:0));
  useEffect(()=>{
    if(reduceMotion){selection.setValue(item.selected?1:0);return;}
    const animation=Animated.timing(selection,{toValue:item.selected?1:0,duration:160,useNativeDriver:true});
    animation.start();
    return ()=>animation.stop();
  },[item.selected,reduceMotion,selection]);
  const ink=item.selected?colors['accent-fill']:colors['fg-muted'];
  return <Pressable accessibilityRole="tab" accessibilityState={{selected:item.selected}} aria-selected={item.selected}
    accessibilityLabel={item.label} onPress={item.onPress}
    className="min-w-0 flex-1 items-center gap-y-[3px]" style={{minHeight:48,borderRadius:16,backgroundColor:'transparent'}}>
    {({pressed})=><>
      <Animated.View testID="editorial-tab-glyph" className="items-center justify-center" style={{width:26,height:26,
        transform:[{translateY:pressed?0:selection.interpolate({inputRange:[0,1],outputRange:[0,-1]})},{scale:pressed&&!reduceMotion?.94:1}]}}>
        {item.key==='create'?<VeeMark size={26} variant="compact" color={ink} />:
          <Glyph name={item.glyph} size={18} color={ink} strokeWidth={1.7} />}
      </Animated.View>
      <Text numberOfLines={1} className={item.selected?'font-dm-medium':'font-dm'} style={{fontSize:11,lineHeight:14,
        color:item.selected?colors.fg:colors['fg-muted']}}>{item.label}</Text>
      <Animated.View testID="editorial-tab-indicator" style={{width:3,height:3,borderRadius:2,
        backgroundColor:colors['accent-fill'],opacity:selection,transform:[{scale:selection.interpolate({inputRange:[0,1],outputRange:[.6,1]})}]}} />
    </>}
  </Pressable>;
}

/** One floating pill treatment for tabs and the detail-screen navigation. */
export function EditorialNav({items,reserveSpace=false}:{items:NavigationItem[];reserveSpace?:boolean}) {
  const colors=useThemeColors(),insets=useSafeAreaInsets(),gutter=useAppGutter();
  const {colorScheme}=useColorScheme(),reduceMotion=useReducedMotionPreference();
  const light=colorScheme==='light';
  const bottom=insets.bottom+18;
  /** Far enough to clear the pill, its bottom offset and its shadow. */
  const tuckAway=bottom+86;
  // Floating only. In reserveSpace mode the bar is a block in the flow of a
  // pushed screen, with nothing scrolling underneath it to get out of the way
  // of, and sliding it would leave a hole.
  const tuck=useAnimatedStyle(()=>({transform:[{translateY:navHidden.value*tuckAway}]}));
  const hides=!reserveSpace&&!reduceMotion;
  return <View pointerEvents="box-none" style={reserveSpace?{height:bottom+76}:{position:'absolute',left:0,right:0,bottom:0,height:bottom+76}}>
    {/* Layout lives in `style`, not `className`: nativewind does not wrap
      * Reanimated.View, so a className on it is silently dropped and the pill
      * stacks its tabs vertically. */}
    <Reanimated.View testID="editorial-navigation" accessibilityRole="tablist"
      style={[{flexDirection:'row',alignItems:'center',borderRadius:999,
        position:'absolute',left:gutter,right:gutter,bottom,paddingTop:9,paddingBottom:8,paddingHorizontal:10,
        backgroundColor:withAlpha(colors['surface-navigation'],.97),borderWidth:1,borderColor:colors['edge-card'],borderBottomColor:colors['edge-card-bottom'],
        boxShadow:light?'inset 0 1px 0 rgba(255,255,255,.82), 0 6.6px 24.2px rgba(49,32,57,.1045)':'0 6.6px 24.2px rgba(0,0,0,.352)',
        ...(Platform.OS==='web'?{backdropFilter:'blur(18px)'}:{})}, hides?tuck:null]}>
      {items.map(item=><EditorialTab key={item.key} item={item} reduceMotion={reduceMotion} />)}
    </Reanimated.View>
  </View>;
}
