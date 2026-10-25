import { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailAssistantDock } from '@/components/detail-assistant';
import { Glyph } from '@/components/glyph';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { Photo } from '@/components/photo';
import { useActiveCityName } from '@/lib/city';
import { useNow } from '@/lib/clock';
import type { DetailContext } from '@/lib/detail-assistant';
import { compactJournalFacts } from '@/lib/detail-journal';
import { useThemeColors } from '@/lib/theme';

export type LedgerFact = {label:string;value:string;glyph?:string;fullValue?:string};
export type LedgerChip = {key:string;label:string;glyph?:string;onPress?:()=>void;selected?:boolean;accent?:boolean;accessibilityLabel?:string;testID?:string};
export type LedgerFold = {key:string;label:string;glyph?:string;chapter?:'menu'|'more';children:ReactNode};

const shortTitle=(name:string)=>{const words=name.trim().split(/\s+/);return words.length>5?words.slice(0,5).join(' ')+'…':name;};
export const ledgerFactGlyph=(label:string)=>/address|location|venue|destination/i.test(label)?'pin':/hours|time|doors|when|duration/i.test(label)?'clock':/menu|service|cuisine/i.test(label)?'food':/phone/i.test(label)?'phone':/price|tickets|cost/i.test(label)?'ticket':'compass';

export function JournalQuietAction({chip}: {chip:LedgerChip}) {
  const colors=useThemeColors();
  return <TouchableOpacity testID={chip.testID} accessibilityRole="button" accessibilityLabel={chip.accessibilityLabel||chip.label} onPress={chip.onPress} activeOpacity={.76}
    style={{flex:1,minHeight:40,borderRadius:12,backgroundColor:colors['surface-navigation'],borderWidth:1,borderColor:colors['edge-card'],borderBottomColor:colors['edge-card-bottom'],flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:10}}>
    {chip.glyph?<Glyph name={chip.glyph} size={13} color={colors['surface-accent']} />:null}
    <Text numberOfLines={1} className="font-dm-medium text-fine text-ink">{chip.label}</Text>
  </TouchableOpacity>;
}

export function JournalFold({label,children,testID}: {label:string;children:ReactNode;testID?:string}) {
  const colors=useThemeColors(),[open,setOpen]=useState(false);
  return <View style={{borderTopWidth:1,borderBottomWidth:1,borderColor:colors['edge-faint']}}>
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityState={{expanded:open}} aria-expanded={open} accessibilityLabel={label} onPress={()=>setOpen(value=>!value)} activeOpacity={.72}
      style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <Text className="font-dm-medium text-fine text-ink" style={{flex:1}}>{label}</Text>
      <Glyph name={open?'minus':'plus'} size={15} color={colors['surface-accent']} />
    </TouchableOpacity>
    {open?<View style={{gap:12,paddingBottom:14}}>{children}</View>:null}
  </View>;
}

/** Open Dossier identity, inline facts and the selected Journal content.
 * Source-specific controls remain real native components. */
export function LedgerCompanionScreen({context,image,glyph='landmark',eyebrow,headingEyebrow,chips=[],primaryAction,essentials=[],compactFacts,folds=[],journal,children,navActive='home'}: {
  context:DetailContext;image?:string;glyph?:string;eyebrow?:string;headingEyebrow?:string;chips?:LedgerChip[];primaryAction?:LedgerChip;essentials?:LedgerFact[];compactFacts?:LedgerFact[];folds?:LedgerFold[];journal?:ReactNode;children?:ReactNode;
  navActive?:'home'|'discover'|'create'|'profile';
}) {
  const colors=useThemeColors(),now=useNow(),city=useActiveCityName(),router=useRouter();
  const save=chips.find(chip=>chip.key==='save'),directions=chips.find(chip=>chip.key==='directions');
  const mainAction=primaryAction||chips.find(chip=>chip.key==='book');
  const metadata=chips.filter(chip=>!['save','directions','book'].includes(chip.key)&&!context.caption?.includes(chip.label));
  const inline=compactFacts||compactJournalFacts(essentials);
  const caption=[context.caption,...metadata.map(chip=>chip.label)].filter(Boolean).join(' · ');
  const about=essentials.length>0||folds.length>0;
  return <HomeGuideScreen now={now} search={false} context={false} header={false} activeTab={navActive}
    beforeNav={<DetailAssistantDock key={context.kind+':'+context.id} context={context} />}>
    <View testID="ledger-companion" style={{gap:22,paddingBottom:4}}>
      <View style={{gap:18}}>
        <View style={{minHeight:40,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <TouchableOpacity testID="ledger-back" accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.canGoBack()?router.back():router.replace('/')} activeOpacity={.76}
            style={{width:38,height:38,borderRadius:19,backgroundColor:colors['surface-control'],borderWidth:1,borderColor:colors['edge-card'],alignItems:'center',justifyContent:'center'}}>
            <Glyph name="back" size={16} color={colors.fg} />
          </TouchableOpacity>
          <Text numberOfLines={1} className="font-dm text-fine uppercase text-taupe" style={{flexShrink:1,letterSpacing:1}}>{city} · {eyebrow||'Wayvee'}</Text>
          {save?.onPress?<TouchableOpacity testID={save.testID||'ledger-save'} accessibilityRole="button" accessibilityLabel={save.accessibilityLabel||save.label} accessibilityState={{selected:save.selected}} onPress={save.onPress} activeOpacity={.76}
            style={{width:38,height:38,borderRadius:19,backgroundColor:colors['surface-control'],borderWidth:1,borderColor:colors['edge-card'],alignItems:'center',justifyContent:'center'}}>
            <Glyph name={save.selected?'check':'bookmark'} size={16} color={save.selected?colors['surface-accent']:colors.fg} />
          </TouchableOpacity>:<View style={{width:38}} />}
        </View>
        <View style={{gap:7}}>
          {headingEyebrow?<Text className="font-dm-medium text-fine uppercase text-peach" style={{letterSpacing:1}}>{headingEyebrow}</Text>:null}
          <Text testID="ledger-title" accessibilityRole="header" accessibilityLabel={context.name} numberOfLines={2} className="font-fraunces text-ink" style={{fontSize:32,lineHeight:35,letterSpacing:-.75}}>{shortTitle(context.name)}</Text>
          {caption?<Text testID="ledger-chip-row" numberOfLines={2} className="font-dm text-fine text-taupe" style={{lineHeight:17}}>{caption}</Text>:null}
        </View>
        <View testID="ledger-photo" style={{height:context.kind==='event'?182:124,borderRadius:13,overflow:'hidden'}}>
          <Photo uri={image} fit="cover" radius={13} stripedPlaceholder={false} fallbackGlyph={glyph} fallbackLabel={`Photo unavailable for ${context.name}`} style={{height:'100%',width:'100%'}} />
        </View>
        <View style={{gap:9}}>
          {context.snapshot?<Text testID="ledger-snapshot" numberOfLines={3} ellipsizeMode="tail" className="font-dm text-label text-taupe" style={{width:'100%',lineHeight:19}}>{context.snapshot}</Text>:null}
          {inline.length?<View testID="ledger-facts" style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',columnGap:12,rowGap:2}}>{inline.map((fact,index)=>{
            const onPress=/address|location|venue|destination/i.test(fact.label)?directions?.onPress:undefined;
            const content=<><Glyph name={fact.glyph||ledgerFactGlyph(fact.label)} size={12} color={colors['surface-accent']} />
              <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-fine text-taupe" style={{flexShrink:1,lineHeight:18}}>{fact.value}</Text>
              {onPress?<Glyph name="navigation" size={12} color={colors['surface-accent']} />:null}</>;
            return onPress?<TouchableOpacity key={index} accessibilityRole="button" accessibilityLabel={`Directions. ${essentials.find(item=>/address/i.test(item.label))?.value||fact.value}`} onPress={onPress} style={{maxWidth:'100%',minHeight:28,flexDirection:'row',alignItems:'center',gap:6}}>{content}</TouchableOpacity>
              :<View key={index} accessible accessibilityLabel={fact.label+': '+(fact.fullValue||fact.value)} style={{maxWidth:'100%',minHeight:22,flexDirection:'row',alignItems:'center',gap:6}}>{content}</View>;
          })}</View>:null}
        </View>
      </View>
      {journal}
      {children}
      {!journal&&(directions||mainAction)?<View style={{flexDirection:'row',gap:8}}>
        {directions?<JournalQuietAction chip={directions} />:null}
        {mainAction?<JournalQuietAction chip={mainAction} />:null}
      </View>:null}
      {about?<JournalFold label={context.kind==='event'?'Before you go':'About & visit'} testID="journal-about">
        {essentials.map((fact,index)=><View key={index} style={{gap:3}}><Text className="font-dm-medium text-fine text-ink">{fact.label}</Text><Text className="font-dm text-label text-taupe" style={{lineHeight:19}}>{fact.value}</Text></View>)}
        {folds.map(fold=><View key={fold.key} testID={'journal-fold-'+fold.key} style={{gap:9,paddingTop:10,borderTopWidth:1,borderTopColor:colors['edge-faint']}}>
          <Text className="font-dm-medium text-label text-ink">{fold.label}</Text>{fold.children}
        </View>)}
      </JournalFold>:null}
    </View>
  </HomeGuideScreen>;
}
