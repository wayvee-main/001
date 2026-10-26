import { useColorScheme } from 'nativewind';
import type { ReactNode, Ref } from 'react';
import { Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { useControlSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

// Home's 37px action, 7px top/bottom insets and 1px perimeter total 53px.
// Keep this geometry identical for launchers and editable search fields.
export const SEARCH_BAR_HEIGHT = 53;
export function CitySearchBar({city,testID,labelTestID,inputTestID,inputLabel,placeholder,value='',onChangeText,onPress,onSubmit,autoFocus=false,inputRef}: {
  city:string;testID:string;labelTestID?:string;inputLabel?:string;value?:string;
  inputTestID?:string;placeholder?:string;autoFocus?:boolean;inputRef?:Ref<TextInput>;
  onChangeText?:(text:string)=>void;onPress?:()=>void;onSubmit?:(query:string)=>void;
}) {
  const colors=useThemeColors(),control=useControlSurface(),primary=useControlSurface(false,true);
  const label=placeholder || `Search the city of ${/^san francisco$/i.test(city)?'SF':city}`;
  const submit=()=>{Keyboard.dismiss();onSubmit?.(value.trim());};
  const arrow=<View style={[primary,{width:37,height:37,borderRadius:999,alignItems:'center',justifyContent:'center'}]}>
    <Glyph name="arrow" size={17} color={colors['on-accent']} />
  </View>;
  const content=<>
    <Glyph name="search" size={17} color={colors['fg-muted']} />
    {onChangeText?<TextInput ref={inputRef} testID={inputTestID || `${testID}-input`} accessibilityLabel={inputLabel || label} value={value} onChangeText={onChangeText}
      autoFocus={autoFocus} autoCorrect={false} placeholder={label} placeholderTextColor={colors['fg-muted']} returnKeyType="search" onSubmitEditing={submit}
      className="wayvee-search-input min-w-0 flex-1 font-dm text-label text-ink" style={{height:37,padding:0,borderWidth:0,outlineWidth:0}} />:
      <Text testID={labelTestID} numberOfLines={1} className="min-w-0 flex-1 font-dm text-label text-taupe">{value || label}</Text>}
    {onChangeText&&value?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={()=>onChangeText('')}><Glyph name="close" size={14} color={colors['fg-muted']} /></TouchableOpacity>:null}
    {onChangeText?<TouchableOpacity accessibilityRole="button" accessibilityLabel={inputLabel || label} onPress={submit}>{arrow}</TouchableOpacity>:arrow}
  </>;
  const style=[control,{height:SEARCH_BAR_HEIGHT,width:'100%' as const,backgroundColor:colors['surface-search'],borderRadius:999,
    flexDirection:'row' as const,alignItems:'center' as const,gap:10,paddingLeft:14,paddingRight:7,paddingVertical:7}];
  return onPress?<TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={inputLabel || label} onPress={onPress} style={style}>{content}</TouchableOpacity>:
    <View testID={testID} style={style}>{content}</View>;
}

/** Home's venue chips and Discover's filters share the same quiet material. */
export function CityChip({label,glyph,icon,onPress,selected=false,borderless=false,maxWidth,testID,accessibilityLabel}: {
  label:string;glyph?:string;icon?:ReactNode;onPress:()=>void;selected?:boolean;borderless?:boolean;maxWidth?:number;testID?:string;accessibilityLabel?:string;
}) {
  const colors=useThemeColors(),control=useControlSurface(selected),{colorScheme}=useColorScheme();
  return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{selected}} onPress={onPress} activeOpacity={.72} hitSlop={{top:6,bottom:6}}
    style={[control,{backgroundColor:selected?colors['selected-surface']:colorScheme==='light'?colors['surface-search']:colors['surface-control'],maxWidth},borderless?{borderWidth:0}:undefined]}
    className="min-h-[34px] flex-row items-center gap-x-1.5 rounded-full px-2.5 py-[7px] border border-edge-card border-b-edge-card-bottom shadow-soft-light dark:shadow-soft-dark">
    {icon || (glyph?<Glyph name={glyph} size={13} color={selected?colors['selected-glyph']:colors['fg-muted']} />:null)}
    <Text numberOfLines={1} className="min-w-0 shrink font-dm text-fine" style={{color:selected?colors['on-selected']:colors.fg}}>{label}</Text>
  </TouchableOpacity>;
}
