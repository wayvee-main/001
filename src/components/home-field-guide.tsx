import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { EditorialNav } from '@/components/editorial-nav';
import { Glyph } from '@/components/glyph';
import { Screen, ScreenScroll } from '@/components/layout';
import { Photo } from '@/components/photo';
import { WayveeWordmark } from '@/components/wayvee-wordmark';
import { EmptyState } from '@/components/ui';
import { useActiveCityName } from '@/lib/city';
import { currentDaypart } from '@/lib/daypart';
import { homeGuideHref, type HomeGuideEntry, type HomeGuideFact } from '@/lib/home-guide';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

export const HOME_DOOR_HEIGHT = 83;
const briefTitle = (name: string) => {const words=name.trim().split(/\s+/);return words.length>5?words.slice(0,5).join(' ')+'…':name;};

/** Same exact height, inset, typography and chevron for For you and Collections. */
export function HomeDoorCard({title,meta,image,glyph='compass',width,onPress,testID}: {
  title:string;meta:string;image?:string;glyph?:string;width?:number;onPress:()=>void;testID?:string;
}) {
  const colors=useThemeColors(),surface=useRaisedSurface(1);
  return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} activeOpacity={.78} onPress={onPress}
    style={[surface,{height:HOME_DOOR_HEIGHT,width,flexShrink:0,padding:11,borderRadius:15,flexDirection:'row',alignItems:'center',gap:12}]}>
    <Photo uri={image} radius={11} fallbackGlyph={glyph} fallbackLabel={`Photo unavailable for ${title}`} style={{width:58,height:58,backgroundColor:colors['surface-sunk']}} />
    <View className="min-w-0 flex-1">
      <Text numberOfLines={2} className="font-dm-medium text-card-name text-ink">{title}</Text>
      <Text numberOfLines={1} className="mt-1 font-dm text-fine text-taupe">{meta}</Text>
    </View>
    <Glyph name="chevron" size={14} color={colors['surface-accent']} />
  </TouchableOpacity>;
}

/** Used only by /home routes. Existing Discover and its detail routes do not use this frame. */
export function HomeGuideScreen({children,now,backLabel='Back',search=true}: {children:ReactNode;now:Date;backLabel?:string;search?:boolean}) {
  const router=useRouter(),colors=useThemeColors(),city=useActiveCityName();
  const period={morning:'This morning',midday:'This afternoon',afternoon:'This afternoon',evening:'This evening',lateNight:'After hours'}[currentDaypart(now)];
  return <Screen><View testID="home-field-guide" style={{flex:1}}>
    <ScreenScroll gap={18} keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center justify-between gap-x-3 py-2">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={backLabel} onPress={()=>router.canGoBack()?router.back():router.replace('/')} hitSlop={10} className="min-h-9 flex-row items-center gap-x-1.5">
          <Glyph name="back" size={16} color={colors.fg} /><Text className="font-dm text-label text-ink">{backLabel}</Text>
        </TouchableOpacity>
        <WayveeWordmark size={17} mark={false} />
        {search?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Search Home" onPress={()=>router.push('/home/browse?category=all')}
          style={{width:32,height:32,borderRadius:16,backgroundColor:colors['surface-raised'],borderWidth:1,borderColor:colors['edge-card'],borderBottomColor:colors['edge-card-bottom'],alignItems:'center',justifyContent:'center'}}>
          <Glyph name="search" size={16} color={colors['fg-muted']} />
        </TouchableOpacity>:<View style={{width:32}} />}
      </View>
      <View className="flex-row items-center gap-x-1.5"><Glyph name="compass" size={12} color={colors['surface-accent']} />
        <Text numberOfLines={1} className="font-dm text-fine text-peach">{city} · {period}</Text>
      </View>
      {children}
    </ScreenScroll>
    <EditorialNav reserveSpace items={[
      {key:'index',label:'Home',glyph:'home',selected:true,onPress:()=>router.replace('/')},
      {key:'discover',label:'Discover',glyph:'compass',selected:false,onPress:()=>router.push('/discover')},
      {key:'create',label:'Vee',glyph:'spark',selected:false,onPress:()=>router.push('/create')},
      {key:'profile',label:'You',glyph:'user',selected:false,onPress:()=>router.push('/profile')},
    ]} />
  </View></Screen>;
}

export function HomeGuideHeading({title,subtitle}: {title:string;subtitle?:string}) {
  return <View className="gap-y-2">
    <Text accessibilityRole="header" accessibilityLabel={title} className="font-fraunces text-ink" style={{fontSize:32,lineHeight:35.2,letterSpacing:-.7}}>{briefTitle(title)}</Text>
    {subtitle?<Text className="font-dm text-label text-taupe">{subtitle}</Text>:null}
  </View>;
}

export function HomeGuideFacts({facts}: {facts:readonly HomeGuideFact[]}) {
  const colors=useThemeColors();
  return <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
    {facts.slice(0,2).map((fact,i)=><View key={i} accessibilityLabel={fact.label || fact.value} style={{flexDirection:'row',alignItems:'center',gap:4,minWidth:0,flexShrink:1}}>
      <Glyph name={fact.glyph} size={12} color={colors['fg-muted']} />
      <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{flexShrink:1}}>{fact.value}</Text>
    </View>)}
  </View>;
}

export function HomeGuidePills({values,value,onChange}: {values:readonly string[];value:string;onChange:(value:string)=>void}) {
  const colors=useThemeColors(),control=useControlSurface(),selected=useControlSurface(true);
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{values.map(label=><TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:label===value}} onPress={()=>onChange(label)} activeOpacity={.78}
    style={[label===value?selected:control,{borderRadius:999,paddingHorizontal:12,paddingVertical:9,minHeight:34}]}>
    <Text className="font-dm text-fine" style={{color:label===value?colors['on-selected']:colors.fg}}>{label}</Text>
  </TouchableOpacity>)}</View>;
}

export function HomeGuideRow({entry}: {entry:HomeGuideEntry}) {
  const router=useRouter(),colors=useThemeColors();
  return <TouchableOpacity testID="home-guide-row" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${entry.caption}. ${entry.facts.map(x=>x.label || x.value).join('. ')}`}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.78} className="flex-row items-center gap-x-3 border-t border-edge-faint py-3">
    <Photo uri={entry.image} radius={10} fallbackGlyph={entry.glyph} fallbackLabel={entry.kind==='collection'?`${entry.name} collection`:`Photo unavailable for ${entry.name}`} style={{width:70,height:70}} />
    <View className="min-w-0 flex-1 gap-y-1.5"><Text numberOfLines={1} className="font-fraunces text-ink" style={{fontSize:17,lineHeight:20.7,letterSpacing:-.15}}>{briefTitle(entry.name)}</Text>
      <Text numberOfLines={1} className="font-dm text-fine text-taupe">{entry.caption}</Text>
      <HomeGuideFacts facts={entry.facts} />
    </View>
    <Glyph name="chevron" size={14} color={colors['surface-accent']} />
  </TouchableOpacity>;
}

export function HomeGuideLead({entry}: {entry:HomeGuideEntry}) {
  const router=useRouter(),colors=useThemeColors(),surface=useRaisedSurface(1),control=useControlSurface();
  return <View testID="home-guide-lead" style={[surface,{padding:14,borderRadius:15,gap:12}]}>
    <Text className="font-dm text-fine uppercase tracking-[1px] text-taupe">A place to begin</Text>
    <View className="flex-row items-center gap-x-3">
      <Photo uri={entry.image} radius={10} fallbackGlyph={entry.glyph} fallbackLabel={entry.kind==='collection'?`${entry.name} collection`:`Photo unavailable for ${entry.name}`} style={{width:65,height:65}} />
      <View className="min-w-0 flex-1 gap-y-1.5"><Text numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:17,lineHeight:20.7}}>{briefTitle(entry.name)}</Text>
        <Text numberOfLines={1} className="font-dm text-fine text-taupe">{entry.caption}</Text><HomeGuideFacts facts={entry.facts} />
      </View>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Take a closer look at ${entry.name}`} onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.78}
      style={[control,{minHeight:38,borderRadius:999,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6}]}>
      <Text className="font-dm text-fine text-ink">Take a closer look</Text><Glyph name="arrow" size={13} color={colors['surface-accent']} />
    </TouchableOpacity>
  </View>;
}

export function HomeGuideList({entries,empty='Try another idea or check back as local listings update.'}: {entries:readonly HomeGuideEntry[];empty?:string}) {
  if(!entries.length)return <EmptyState compact title="Nothing here just yet" message={empty} />;
  return <View className="gap-y-5"><HomeGuideLead entry={entries[0]} />
    {entries.length>1?<View className="gap-y-2"><View className="flex-row items-center justify-between gap-x-3"><Text className="font-fraunces text-section text-ink">More good options</Text><Text className="font-dm text-fine text-taupe">{entries.length-1} more</Text></View>
      {entries.slice(1).map(entry=><HomeGuideRow key={entry.kind+':'+entry.id} entry={entry} />)}
    </View>:null}
  </View>;
}
