import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { useControlSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

/** Home and Discover share one search silhouette, type scale and action. */
export function CitySearchBar({city,testID,labelTestID,inputLabel,value='',onChangeText,onPress}: {
  city:string;testID:string;labelTestID?:string;inputLabel?:string;value?:string;
  onChangeText?:(text:string)=>void;onPress?:()=>void;
}) {
  const colors=useThemeColors(),control=useControlSurface(),primary=useControlSurface(false,true);
  const label=`Search the city of ${/^san francisco$/i.test(city)?'SF':city}`;
  const arrow=<View style={[primary,{width:37,height:37,borderRadius:999,alignItems:'center',justifyContent:'center'}]}>
    <Glyph name="arrow" size={17} color={colors['on-accent']} />
  </View>;
  const content=<>
    <Glyph name="search" size={17} color={colors['fg-muted']} />
    {onChangeText?<TextInput testID={`${testID}-input`} accessibilityLabel={inputLabel || label} value={value} onChangeText={onChangeText}
      placeholder={label} placeholderTextColor={colors['fg-muted']} returnKeyType="search" onSubmitEditing={Keyboard.dismiss}
      className="min-w-0 flex-1 font-dm text-label text-ink" style={{height:37,padding:0,borderWidth:0,outlineWidth:0}} />:
      <Text testID={labelTestID} numberOfLines={1} className="min-w-0 flex-1 font-dm text-label text-taupe">{label}</Text>}
    {onChangeText&&value?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={()=>onChangeText('')}><Glyph name="close" size={14} color={colors['fg-muted']} /></TouchableOpacity>:null}
    {onChangeText?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Search Discover" onPress={Keyboard.dismiss}>{arrow}</TouchableOpacity>:arrow}
  </>;
  const style=[control,{minHeight:52,backgroundColor:colors['surface-search']}];
  const className='flex-row items-center gap-x-2.5 rounded-full pl-3.5 pr-[7px] py-[7px] border border-edge-card border-b-edge-card-bottom shadow-soft-light dark:shadow-soft-dark';
  return onPress?<TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style} className={className}>{content}</TouchableOpacity>:
    <View testID={testID} style={style} className={className}>{content}</View>;
}

/** Home's venue chips and Discover's filters share the same quiet material. */
export function CityChip({label,glyph,icon,onPress,selected=false,maxWidth,testID,accessibilityLabel}: {
  label:string;glyph?:string;icon?:ReactNode;onPress:()=>void;selected?:boolean;maxWidth?:number;testID?:string;accessibilityLabel?:string;
}) {
  const colors=useThemeColors(),control=useControlSurface(selected),{colorScheme}=useColorScheme();
  return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{selected}} onPress={onPress} activeOpacity={.72} hitSlop={{top:6,bottom:6}}
    style={[control,{backgroundColor:selected?colors['selected-surface']:colorScheme==='light'?colors['surface-search']:colors['surface-control'],maxWidth}]}
    className="min-h-[34px] flex-row items-center gap-x-1.5 rounded-full px-2.5 py-[7px] border border-edge-card border-b-edge-card-bottom shadow-soft-light dark:shadow-soft-dark">
    {icon || (glyph?<Glyph name={glyph} size={13} color={selected?colors['selected-glyph']:colors['fg-muted']} />:null)}
    <Text numberOfLines={1} className="min-w-0 shrink font-dm text-fine" style={{color:selected?colors['on-selected']:colors.fg}}>{label}</Text>
  </TouchableOpacity>;
}
