import { useState, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailAssistantDock } from '@/components/detail-assistant';
import { Glyph } from '@/components/glyph';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { useAppGutter } from '@/components/layout';
import { Photo } from '@/components/photo';
import { useActiveCityName } from '@/lib/city';
import { useNow } from '@/lib/clock';
import type { DetailContext } from '@/lib/detail-assistant';
import { useThemeColors } from '@/lib/theme';

export type LedgerFact = {label:string;value:string;glyph?:string};
export type LedgerChip = {key:string;label:string;glyph?:string;onPress?:()=>void;selected?:boolean;accent?:boolean;accessibilityLabel?:string;testID?:string};
export type LedgerFold = {key:string;label:string;glyph?:string;chapter?:'menu'|'more';children:ReactNode};

const shortTitle=(name:string)=>{const words=name.trim().split(/\s+/);return words.length>5?words.slice(0,5).join(' ')+'…':name;};
export const ledgerFactGlyph=(label:string)=>/address|location|venue|destination/i.test(label)?'pin':/hours|time|doors|when|duration/i.test(label)?'clock':/menu|service|cuisine/i.test(label)?'food':/phone/i.test(label)?'phone':/price|tickets|cost/i.test(label)?'ticket':'compass';

function QuietAction({chip}: {chip:LedgerChip}) {
  const colors=useThemeColors();
  return <TouchableOpacity testID={chip.testID} accessibilityRole="button" accessibilityLabel={chip.accessibilityLabel||chip.label} onPress={chip.onPress} activeOpacity={.76}
    style={{flex:1,minHeight:40,borderRadius:12,backgroundColor:colors['surface-navigation'],borderWidth:1,borderColor:colors['edge-card'],borderBottomColor:colors['edge-card-bottom'],flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:10}}>
    {chip.glyph?<Glyph name={chip.glyph} size={13} color={colors['surface-accent']} />:null}
    <Text numberOfLines={1} className="font-dm-medium text-fine text-ink">{chip.label}</Text>
  </TouchableOpacity>;
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

/** Marquee treatment shared by Home and source-specific detail routes. The
 * source photo leads, with a dark scrim keeping the identity readable. */
export function LedgerCompanionScreen({context,image,glyph='landmark',eyebrow,chips=[],primaryAction,essentials=[],folds=[],children,navActive='home'}: {
  context:DetailContext;image?:string;glyph?:string;eyebrow?:string;chips?:LedgerChip[];primaryAction?:LedgerChip;essentials?:LedgerFact[];folds?:LedgerFold[];children?:ReactNode;
  navActive?:'home'|'discover'|'create'|'profile';
}) {
  const colors=useThemeColors(),now=useNow(),city=useActiveCityName(),router=useRouter(),gutter=useAppGutter();
  const [chapter,setChapter]=useState<'visit'|'menu'|'more'>('visit');
  const save=chips.find(chip=>chip.key==='save'),directions=chips.find(chip=>chip.key==='directions');
  const mainAction=primaryAction||chips.find(chip=>chip.key==='book');
  const metadata=chips.filter(chip=>chip.key!=='save'&&chip.key!=='directions'&&chip.key!=='book');
  const menu=folds.filter(fold=>fold.chapter==='menu'),more=folds.filter(fold=>fold.chapter!=='menu');
  const chapters=[...(directions||mainAction||children?[{key:'visit' as const,label:'Visit'}]:[]),...(menu.length?[{key:'menu' as const,label:'Menu'}]:[]),...(more.length?[{key:'more' as const,label:'More'}]:[])];
  const active=chapters.some(item=>item.key===chapter)?chapter:chapters[0]?.key;
  return <HomeGuideScreen now={now} search={false} context={false} header={false} activeTab={navActive}
    beforeNav={<DetailAssistantDock key={context.kind+':'+context.id} context={context} />}>
    <View testID="ledger-companion" style={{gap:14}}>
      <View testID="ledger-photo" style={{height:258,marginHorizontal:-gutter,position:'relative',overflow:'hidden',backgroundColor:colors['surface-soft']}}>
        <Photo uri={image} fit="cover" radius={0} stripedPlaceholder={false} fallbackGlyph={glyph} fallbackLabel={`Photo unavailable for ${context.name}`} style={{height:'100%',width:'100%'}} />
        <LinearGradient pointerEvents="none" colors={['#15111719','#15111733','#151117E8']} locations={[0,.47,1]} style={{position:'absolute',top:0,left:0,right:0,bottom:0}} />
        <View style={{position:'absolute',top:10,left:gutter,right:gutter,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <TouchableOpacity testID="ledger-back" accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.canGoBack()?router.back():router.replace('/')} activeOpacity={.76}
            style={{width:40,height:40,borderRadius:20,backgroundColor:'#FFFEFAE6',borderWidth:1,borderColor:'#FFFFFF99',alignItems:'center',justifyContent:'center'}}>
            <Glyph name="back" size={17} color="#28252A" />
          </TouchableOpacity>
          {save?.onPress?<TouchableOpacity testID={save.testID||'ledger-save'} accessibilityRole="button" accessibilityLabel={save.accessibilityLabel||save.label} accessibilityState={{selected:save.selected}} onPress={save.onPress} activeOpacity={.76}
            style={{width:40,height:40,borderRadius:20,backgroundColor:'#FFFEFAE6',borderWidth:1,borderColor:'#FFFFFF99',alignItems:'center',justifyContent:'center'}}>
            <Glyph name={save.selected?'check':'bookmark'} size={16} color={save.selected?'#AA5034':'#28252A'} />
          </TouchableOpacity>:null}
        </View>
        <View style={{position:'absolute',bottom:18,left:gutter,right:gutter,gap:6}}>
          <Text className="font-dm-medium text-fine uppercase" style={{letterSpacing:1.1,color:'#F5BCA7'}}>{eyebrow||'Wayvee'} · {city}</Text>
          <Text testID="ledger-title" accessibilityRole="header" accessibilityLabel={context.name} numberOfLines={2} className="font-fraunces" style={{fontSize:32,lineHeight:35,letterSpacing:-.75,color:'#FFF8F1'}}>{shortTitle(context.name)}</Text>
          {context.caption?<Text numberOfLines={1} className="font-dm text-label" style={{color:'#EEE0DC'}}>{context.caption}</Text>:null}
        </View>
      </View>
      {metadata.length?<View testID="ledger-chip-row" style={{flexDirection:'row',paddingVertical:4,borderTopWidth:1,borderBottomWidth:1,borderColor:colors['edge-faint']}}>
        {metadata.map((chip,index)=><View key={chip.key} accessibilityLabel={chip.accessibilityLabel||chip.label} style={{flexShrink:1,paddingVertical:8,paddingHorizontal:index?12:0,borderRightWidth:index<metadata.length-1?1:0,borderRightColor:colors['edge-faint']}}>
          <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm-medium text-label text-ink">{chip.label}</Text>
        </View>)}
      </View>:null}
      {context.snapshot?<Text testID="ledger-snapshot" numberOfLines={2} ellipsizeMode="tail" className="font-dm text-label text-taupe" style={{width:'100%',lineHeight:19}}>{context.snapshot}</Text>:null}
      {essentials.length?<View testID="ledger-facts" style={{backgroundColor:colors['surface-raised'],borderWidth:1,borderColor:colors['edge-card'],borderRadius:15,paddingHorizontal:14}}>
        {essentials.map((fact,index)=><View key={fact.label+':'+index} style={{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:11,borderBottomWidth:index<essentials.length-1?1:0,borderBottomColor:colors['edge-faint']}}>
          <View style={{width:105,flexDirection:'row',alignItems:'flex-start',gap:7,paddingTop:1}}>
            <Glyph name={fact.glyph||ledgerFactGlyph(fact.label)} size={13} color={colors['surface-accent']} />
            <Text className="font-dm text-fine text-taupe" style={{flex:1}}>{fact.label}</Text>
          </View>
          <Text className="min-w-0 flex-1 font-dm text-label text-ink" style={{lineHeight:18,textAlign:'right'}}>{fact.value}</Text>
        </View>)}
      </View>:null}
      {chapters.length?<View testID="ledger-chapters" accessibilityRole="tablist" style={{flexDirection:'row',gap:24,borderBottomWidth:1,borderBottomColor:colors['edge-faint'],marginTop:2}}>
        {chapters.map(item=><TouchableOpacity key={item.key} testID={`ledger-tab-${item.key}`} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:active===item.key}} onPress={()=>setChapter(item.key)} activeOpacity={.72}
          style={{minHeight:42,justifyContent:'center',paddingVertical:10,borderBottomWidth:2,borderBottomColor:active===item.key?colors['surface-accent']:'transparent'}}>
          <Text className="font-dm-medium text-fine" style={{color:active===item.key?colors['surface-accent']:colors['fg-muted']}}>{item.label}</Text>
        </TouchableOpacity>)}
      </View>:null}
      {active==='visit'?<View testID="ledger-visit" style={{gap:12}}>
        {children}
        {directions||mainAction?<View style={{flexDirection:'row',gap:8}}>
          {directions?<QuietAction chip={directions} />:null}
          {mainAction?<QuietAction chip={mainAction} />:null}
        </View>:null}
      </View>:null}
      {active==='menu'?<View testID="ledger-menu">{menu.map(fold=><ChapterSection key={fold.key} fold={fold} />)}</View>:null}
      {active==='more'?<View testID="ledger-more">{more.map(fold=><ChapterSection key={fold.key} fold={fold} />)}</View>:null}
    </View>
  </HomeGuideScreen>;
}
