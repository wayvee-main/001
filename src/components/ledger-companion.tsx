import { useState, type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { DetailAssistantDock } from '@/components/detail-assistant';
import { Glyph } from '@/components/glyph';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { Photo } from '@/components/photo';
import { useActiveCityName } from '@/lib/city';
import { useNow } from '@/lib/clock';
import type { DetailContext } from '@/lib/detail-assistant';
import { useControlSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

export type LedgerFact = {label:string;value:string;glyph?:string};
export type LedgerChip = {key:string;label:string;glyph?:string;onPress?:()=>void;selected?:boolean;accent?:boolean;accessibilityLabel?:string;testID?:string};
export type LedgerFold = {key:string;label:string;glyph?:string;chapter?:'menu'|'more';children:ReactNode};

const shortTitle=(name:string)=>{const words=name.trim().split(/\s+/);return words.length>5?words.slice(0,5).join(' ')+'…':name;};
export const ledgerFactGlyph=(label:string)=>/address|location|venue|destination/i.test(label)?'pin':/hours|time|doors|when|duration/i.test(label)?'clock':/menu|service|cuisine/i.test(label)?'food':/phone/i.test(label)?'phone':/price|tickets|cost/i.test(label)?'ticket':'compass';

function Chip({chip}: {chip:LedgerChip}) {
  const colors=useThemeColors(),control=useControlSurface();
  const content=<>{chip.glyph?<Glyph name={chip.glyph} size={13} color={chip.accent||chip.selected?colors['surface-accent']:colors['fg-muted']} />:null}
    <Text numberOfLines={1} className="font-dm text-fine" style={{color:chip.accent||chip.selected?colors['surface-accent']:chip.onPress?colors.fg:colors['fg-muted']}}>{chip.label}</Text></>;
  const style=[control,{minHeight:34,paddingVertical:7,paddingHorizontal:10,borderRadius:999,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'center' as const,gap:5,backgroundColor:colors['surface-navigation']}];
  return chip.onPress?<TouchableOpacity testID={chip.testID} accessibilityRole="button" accessibilityLabel={chip.accessibilityLabel||chip.label} accessibilityState={{selected:chip.selected}} onPress={chip.onPress} activeOpacity={.75} hitSlop={{top:5,bottom:5}} style={style}>{content}</TouchableOpacity>:
    <View testID={chip.testID} accessibilityLabel={chip.accessibilityLabel||chip.label} style={style}>{content}</View>;
}

function ChapterSection({fold}: {fold:LedgerFold}) {
  const colors=useThemeColors();
  return <View style={{gap:8,paddingVertical:13,borderBottomWidth:1,borderBottomColor:colors['edge-faint']}}>
    {fold.chapter==='menu'&&fold.label==='Menu'?null:<View style={{flexDirection:'row',alignItems:'center',gap:7}}>
      <Glyph name={fold.glyph||'book'} size={13} color={colors['surface-accent']} />
      <Text className="font-dm-medium text-label text-ink">{fold.label}</Text>
    </View>}
    {fold.children}
  </View>;
}

/** Shared ledger for Home and source-specific detail routes. Keep the photo
 * below the name, then put practical facts on aligned ruled rows. */
export function LedgerCompanionScreen({context,image,glyph='landmark',eyebrow,chips=[],essentials=[],folds=[],children,navActive='home'}: {
  context:DetailContext;image?:string;glyph?:string;eyebrow?:string;chips?:LedgerChip[];essentials?:LedgerFact[];folds?:LedgerFold[];children?:ReactNode;
  navActive?:'home'|'discover'|'create'|'profile';
}) {
  const colors=useThemeColors(),now=useNow(),city=useActiveCityName();
  const [chapter,setChapter]=useState<'visit'|'menu'|'more'>('visit');
  const menu=folds.filter(fold=>fold.chapter==='menu'),more=folds.filter(fold=>fold.chapter!=='menu');
  const chapters=[...(essentials.length?[{key:'visit' as const,label:'Visit'}]:[]),...(menu.length?[{key:'menu' as const,label:'Menu'}]:[]),...(more.length||children?[{key:'more' as const,label:'More'}]:[])];
  const active=chapters.some(item=>item.key===chapter)?chapter:chapters[0]?.key;
  return <HomeGuideScreen now={now} search={false} context={false} header={false} activeTab={navActive}
    beforeNav={<DetailAssistantDock key={context.kind+':'+context.id} context={context} />}>
    <View testID="ledger-companion" style={{gap:14,paddingTop:10}}>
      <View style={{gap:11}}>
        {eyebrow?<View style={{flexDirection:'row',alignItems:'center',gap:6}}><Glyph name={glyph} size={12} color={colors['surface-accent']} /><Text className="font-dm text-fine text-peach">{eyebrow} · {city}</Text></View>:null}
        <View style={{gap:7}}>
          <Text testID="ledger-title" accessibilityRole="header" accessibilityLabel={context.name} className="font-fraunces text-ink" style={{fontSize:28,lineHeight:32.2,letterSpacing:-.65}}>{shortTitle(context.name)}</Text>
          {context.caption?<Text numberOfLines={2} className="font-dm text-label text-taupe">{context.caption}</Text>:null}
        </View>
        {image?<View testID="ledger-photo"><Photo uri={image} fit="contain" radius={15} stripedPlaceholder={false} fallbackGlyph={glyph} fallbackLabel={`Photo unavailable for ${context.name}`} style={{width:'100%',aspectRatio:795/464,maxHeight:232}} /></View>:null}
      </View>
      {context.snapshot?<Text testID="ledger-snapshot" numberOfLines={2} ellipsizeMode="tail" className="font-dm text-label text-taupe" style={{width:'100%',lineHeight:19}}>{context.snapshot}</Text>:null}
      {chips.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:-4}} contentContainerStyle={{gap:10,paddingVertical:4}}>
        <View testID="ledger-chip-row" style={{flexDirection:'row',alignItems:'center',gap:10}}>{chips.map(chip=><Chip key={chip.key} chip={chip} />)}</View>
      </ScrollView>:null}
      {chapters.length?<View testID="ledger-chapters" accessibilityRole="tablist" style={{flexDirection:'row',gap:24,borderBottomWidth:1,borderBottomColor:colors['edge-faint'],marginTop:2}}>
        {chapters.map(item=><TouchableOpacity key={item.key} testID={`ledger-tab-${item.key}`} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:active===item.key}} onPress={()=>setChapter(item.key)} activeOpacity={.72}
          style={{minHeight:42,justifyContent:'center',paddingVertical:10,borderBottomWidth:2,borderBottomColor:active===item.key?colors['surface-accent']:'transparent'}}>
          <Text className="font-dm-medium text-fine" style={{color:active===item.key?colors['surface-accent']:colors['fg-muted']}}>{item.label}</Text>
        </TouchableOpacity>)}
      </View>:null}
      {active==='visit'?<View testID="ledger-facts">
          {essentials.map((fact,index)=><View key={fact.label+':'+index} style={{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors['edge-faint']}}>
            <View style={{width:105,flexDirection:'row',alignItems:'flex-start',gap:7,paddingTop:1}}>
              <Glyph name={fact.glyph||ledgerFactGlyph(fact.label)} size={13} color={colors['surface-accent']} />
              <Text className="font-dm text-fine text-taupe" style={{flex:1}}>{fact.label}</Text>
            </View>
            <Text className="min-w-0 flex-1 font-dm text-label text-ink" style={{lineHeight:18,textAlign:'right'}}>{fact.value}</Text>
          </View>)}
      </View>:null}
      {active==='menu'?<View testID="ledger-menu">{menu.map(fold=><ChapterSection key={fold.key} fold={fold} />)}</View>:null}
      {active==='more'?<View testID="ledger-more" style={{gap:children?14:0}}>{more.map(fold=><ChapterSection key={fold.key} fold={fold} />)}{children}</View>:null}
    </View>
  </HomeGuideScreen>;
}
