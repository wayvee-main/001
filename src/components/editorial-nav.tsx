import { useEffect, useState } from 'react';
import { useColorScheme } from 'nativewind';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { useAppGutter } from '@/components/layout';
import { VeeMark } from '@/components/vee-mark';
import { useReducedMotionPreference } from '@/lib/motion';
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
  return <View pointerEvents="box-none" style={reserveSpace?{height:bottom+76}:{position:'absolute',left:0,right:0,bottom:0,height:bottom+76}}>
    <View testID="editorial-navigation" accessibilityRole="tablist" className="flex-row items-center rounded-full"
      style={{position:'absolute',left:gutter,right:gutter,bottom,paddingTop:9,paddingBottom:8,paddingHorizontal:10,
        backgroundColor:withAlpha(colors['surface-navigation'],.97),borderWidth:1,borderColor:withAlpha(colors.fg,.075),
        boxShadow:light?`0 6px 22px ${withAlpha(colors.fg,.095)}`:'0 6px 22px rgba(0,0,0,.32)',
        ...(Platform.OS==='web'?{backdropFilter:'blur(18px)'}:{})}}>
      {items.map(item=><EditorialTab key={item.key} item={item} reduceMotion={reduceMotion} />)}
    </View>
  </View>;
}
