import { useColorScheme } from 'nativewind';
import type { ReactNode, Ref } from 'react';
import { Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuroraCard } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { useNow } from '@/lib/clock';
import { currentDaypart } from '@/lib/daypart';
import { useControlSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

// Daybreak uses the same 49px search geometry on every layer.
export const SEARCH_BAR_HEIGHT = 49;
/** Home and Discover share the two-line launcher. */
export const AURORA_SEARCH_HEIGHT = 64;
export function CitySearchBar({city,testID,labelTestID,inputTestID,inputLabel,placeholder,value='',onChangeText,onPress,onSubmit,autoFocus=false,inputRef,variant='default'}: {
  city:string;testID:string;labelTestID?:string;inputLabel?:string;value?:string;variant?:'default'|'aurora'|'citydesk';
  inputTestID?:string;placeholder?:string;autoFocus?:boolean;inputRef?:Ref<TextInput>;
  onChangeText?:(text:string)=>void;onPress?:()=>void;onSubmit?:(query:string)=>void;
}) {
  const colors=useThemeColors(),control=useControlSurface(),card=useAuroraCard(variant==='citydesk'?'citydesk':undefined),now=useNow();
  const label=placeholder || `Search ${/^san francisco$/i.test(city)?'SF':city}`;
  // Home and Discover launcher: a two-line white pill that opens Search, where the
  // scope filters live, so the filter circle belongs to the same control.
  if((variant==='aurora'||variant==='citydesk')&&onPress){
    const desk=variant==='citydesk';
    const daypart=currentDaypart(now),area=`Anywhere in ${city} · ${daypart==='evening'||daypart==='lateNight'?'Tonight':'Today'}`;
    return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={`${inputLabel || label}. ${area}. Filters on the next screen`} onPress={onPress} activeOpacity={.78}
      style={[card,{height:AURORA_SEARCH_HEIGHT,width:'100%',borderRadius:desk?17:999,flexDirection:'row',alignItems:'center',gap:desk?10:14,paddingLeft:desk?16:22,paddingRight:10}]}>
      <Glyph name="search" size={desk?19:21} color={colors.fg} strokeWidth={1.8} />
      <View style={{flex:1,minWidth:0}}>
        <Text testID={labelTestID} numberOfLines={1} className="font-dm-medium text-ink" style={{fontSize:desk?15:16,lineHeight:21}}>{value || label}</Text>
        <Text testID={`${testID}-area`} numberOfLines={1} className="font-dm" style={{fontSize:desk?11:13,lineHeight:18,color:colors['fg-muted']}}>{area}</Text>
      </View>
      <View testID={`${testID}-filters`} style={{width:desk?36:44,height:desk?36:44,borderRadius:22,borderWidth:desk?0:1,borderColor:colors['control-edge'],backgroundColor:desk?colors['surface-sunk']:undefined,alignItems:'center',justifyContent:'center'}}>
        <Glyph name="filter" size={desk?16:19} color={colors.fg} strokeWidth={1.8} />
      </View>
    </TouchableOpacity>;
  }
  const submit=()=>{Keyboard.dismiss();onSubmit?.(value.trim());};
  const content=<>
    <Glyph name="search" size={17} color={colors['fg-muted']} />
    {onChangeText?<TextInput ref={inputRef} testID={inputTestID || `${testID}-input`} accessibilityLabel={inputLabel || label} value={value} onChangeText={onChangeText}
      autoFocus={autoFocus} autoCorrect={false} placeholder={label} placeholderTextColor={colors['fg-muted']} returnKeyType="search" onSubmitEditing={submit}
      className="wayvee-search-input min-w-0 flex-1 font-dm text-ink" style={{height:33,fontSize:16,lineHeight:22,padding:0,borderWidth:0,outlineWidth:0}} />:
      <Text testID={labelTestID} numberOfLines={1} className="min-w-0 flex-1 font-dm text-taupe" style={{fontSize:13,lineHeight:20}}>{value || label}</Text>}
    {onChangeText&&value?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={()=>onChangeText('')}><Glyph name="close" size={14} color={colors['fg-muted']} /></TouchableOpacity>:null}
    {onChangeText?<TouchableOpacity accessibilityRole="button" accessibilityLabel={inputLabel || label} onPress={submit} hitSlop={6} style={{width:28,height:33,alignItems:'center',justifyContent:'center'}}><Glyph name="arrow" size={16} color={colors['fg-accent']} /></TouchableOpacity>:null}
  </>;
  const style=[control,{height:SEARCH_BAR_HEIGHT,width:'100%' as const,backgroundColor:colors['surface-search'],borderRadius:999,
    flexDirection:'row' as const,alignItems:'center' as const,gap:10,paddingHorizontal:14,paddingVertical:7}];
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
