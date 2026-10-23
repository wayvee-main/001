import * as Linking from 'expo-linking';
import { useLocalSearchParams, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { DetailDisclosure } from '@/components/disclosure-rows';
import type { HubFact } from '@/components/fact-strip';
import { Glyph } from '@/components/glyph';
import { LedgerCompanionScreen, type LedgerChip, type LedgerFact, type LedgerFold } from '@/components/ledger-companion';
import { Icon } from '@/components/ui';
import type { DetailContext } from '@/lib/detail-assistant';
import type { LiveLine } from '@/lib/detail-facts';
import { homeGuideKey } from '@/lib/home-guide';
import { DETAIL_LABELS, ledgerContext, ledgerEssentials, ledgerMetadata, factLabel } from '@/lib/detail-ledger';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

export { DetailDisclosureGroup, whyRow, type DetailDisclosure } from '@/components/disclosure-rows';
export interface DetailScreenAction {label:string;iconD:string;onPress:()=>void}
export interface DetailSection {key:string;title?:string;action?:string;onAction?:()=>void;note?:string;footnote?:string;children:ReactNode}

/** Existing detail routes keep their source-specific controls and content,
 * presented through the same Ledger companion used by Home. */
export function DetailScreen({image,heroActions,title,rating,meta,address,onAddress,lede,live,facts=[],sections=[],rows=[],sourceUrl,sourceLabel,sourceNote,actions=[],navActive='home'}: {
  image?:string;heroActions?:ReactNode;title:string;rating?:number;meta?:string;address?:string;onAddress?:()=>void;lede?:string;live?:LiveLine|null;
  facts?:HubFact[];sections?:DetailSection[];rows?:DetailDisclosure[];sourceUrl?:string;sourceLabel?:string;sourceNote?:string;actions?:DetailScreenAction[];
  navActive?:'home'|'discover'|'create'|'profile';
}) {
  const pathname=usePathname(),params=useLocalSearchParams<{id?:string|string[]}>(),{catalog}=useHomeGuide();
  const id=Array.isArray(params.id)?params.id[0]||'':params.id||'',kind=pathname.split('/').filter(Boolean)[0]||'venue';
  const entry=catalog.entries[homeGuideKey(kind,id)],s=useScoper(),colors=useThemeColors();
  const fromEntry=entry?ledgerContext(entry):null;
  const context:DetailContext={kind,id,name:title,caption:meta||fromEntry?.caption,snapshot:fromEntry?.snapshot||lede,
    facts:[...(fromEntry?.facts||[]),...(address?[{label:'Address',value:address}]:[]),...(live?[{label:'Right now',value:live.label}]:[]),...facts.map(fact=>({label:factLabel(fact.glyph),value:fact.label}))],
    links:fromEntry?.links|| (sourceUrl?[{label:sourceLabel||'Official site',url:sourceUrl}]:[])};
  const essentials:LedgerFact[]=entry?ledgerEssentials(entry):address?[{label:'Address',value:address}]:[];
  if(live){const index=essentials.findIndex(fact=>/hours/i.test(fact.label));if(index>=0)essentials.splice(index,1);essentials.splice(Math.min(1,essentials.length),0,{label:'Right now',value:live.label,glyph:'clock'});}
  const metadata=entry?ledgerMetadata(entry):facts.filter(fact=>/dollar|wallet|route|walk|ticket/.test(fact.glyph)).slice(0,2).map(fact=>({glyph:fact.glyph,value:fact.label}));
  const chips:LedgerChip[]=metadata.map((fact,index)=>({key:'fact-'+index,label:['wallet','dollar'].includes(fact.glyph)?fact.value.split(' · ')[0]:fact.value,glyph:['wallet','dollar'].includes(fact.glyph)?undefined:fact.glyph}));
  const saveKind=entry?.saveKind || (['restaurant','night','venue','place'].includes(kind)?kind as 'restaurant'|'night'|'venue'|'place':undefined);
  const planKind=entry?.planKind || (['event','crawl','pick'].includes(kind)?kind as 'event'|'crawl'|'pick':undefined);
  const saved=saveKind?s.isSaved(saveKind,id):planKind?s.isPlanned(planKind,id):false;
  if(saveKind||planKind)chips.push({key:'save',label:saved?'Saved':'Save',glyph:saved?'check':'bookmark',selected:saved,accessibilityLabel:saved?`Remove ${title} from ${saveKind?'saved places':'plans'}`:`Save ${title}`,
    onPress:()=>{if(saveKind)s.toggleSaved(saveKind,id,title);else if(planKind)s.togglePlan(planKind,id,title);}});
  const directions=context.links.find(link=>/^directions$/i.test(link.label));
  const open=(url:string)=>{void Linking.openURL(url).catch(()=>s.showToast('Could not open that link. Please try again.'));};
  if(directions||onAddress)chips.push({key:'directions',label:'Directions',glyph:'navigation',accent:true,onPress:kind!=='event'&&onAddress?onAddress:directions?()=>open(directions.url):onAddress});
  const secondaryFacts=facts.filter(fact=>!metadata.some(item=>item.value===fact.label));
  for(const fact of secondaryFacts){if(essentials.length>=3)break;if(!essentials.some(item=>item.value===fact.label))essentials.push({label:factLabel(fact.glyph),value:fact.label,glyph:fact.glyph});}
  const folds:LedgerFold[]=rows.map(row=>({key:row.key,label:row.label,glyph:row.glyph,children:row.children}));
  for(const section of sections)folds.push({key:'section-'+section.key,label:section.title||'More about this '+(kind==='event'?'show':'place'),glyph:kind==='event'?'ticket':'compass',children:<View style={{gap:10}}>
    {section.note?<Text className="font-dm text-fine text-taupe">{section.note}</Text>:null}{section.children}
    {section.action&&section.onAction?<TouchableOpacity accessibilityRole="button" accessibilityLabel={section.action} onPress={section.onAction} style={{minHeight:36,justifyContent:'center'}}><Text className="font-dm text-label text-peach">{section.action}</Text></TouchableOpacity>:null}
    {section.footnote?<Text className="font-dm text-fine text-taupe">{section.footnote}</Text>:null}
  </View>});
  if(actions.length||sourceUrl||heroActions||sourceNote)folds.push({key:'actions',label:kind==='restaurant'?'Menu & planning':'Links & planning',glyph:'book',children:<View style={{gap:5}}>
    {actions.map(action=><TouchableOpacity key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={{minHeight:40,flexDirection:'row',alignItems:'center',gap:7}}>
      <Icon d={action.iconD} size={14} color={colors['surface-accent']} /><Text className="font-dm text-label text-peach">{action.label}</Text>
    </TouchableOpacity>)}
    {heroActions?<View style={{flexDirection:'row',gap:8,paddingVertical:5}}>{heroActions}</View>:null}
    {sourceUrl?<TouchableOpacity accessibilityRole="link" accessibilityLabel={sourceLabel||'Official site'} onPress={()=>open(sourceUrl)} style={{minHeight:40,flexDirection:'row',alignItems:'center',gap:7}}><Glyph name="arrow" size={14} color={colors['surface-accent']} /><Text className="font-dm text-label text-peach">{sourceLabel||'Official site'}</Text></TouchableOpacity>:null}
    {sourceNote?<Text className="font-dm text-fine text-taupe" style={{lineHeight:18}}>{sourceNote}</Text>:null}
    {typeof rating==='number'?<Text className="font-dm text-fine text-taupe">Listed rating: {rating}</Text>:null}
  </View>});
  return <LedgerCompanionScreen key={kind+':'+id} context={context} image={image||entry?.image} glyph={entry?.glyph||'landmark'} eyebrow={DETAIL_LABELS[kind]} chips={chips} essentials={essentials} folds={folds} navActive={navActive} />;
}
