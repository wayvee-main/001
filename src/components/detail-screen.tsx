import * as Linking from 'expo-linking';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { DetailDisclosure } from '@/components/disclosure-rows';
import type { HubFact } from '@/components/fact-strip';
import { Glyph } from '@/components/glyph';
import { EventJournal, RestaurantJournal, DetailGoods, JournalHeading } from '@/components/detail-journal';
import { LedgerCompanionScreen, type LedgerChip, type LedgerFact, type LedgerFold } from '@/components/ledger-companion';
import { Icon } from '@/components/ui';
import type { DetailContext } from '@/lib/detail-assistant';
import { EVENTS, RESTAURANTS } from '@/lib/data';
import { eventJournalDetails, eventJournalFacts, restaurantJournalMenu, menuListingForPlace } from '@/lib/detail-journal';
import { detailContentFacts } from '@/lib/detail-content';
import { activeCity } from '@/lib/city';
import { placeForRestaurant, placeForListing } from '@/lib/catalog-identity';
import { useAllPlaces } from '@/lib/places';
import { useRegionalPlace } from '@/lib/use-regional-places';
import { detailPlanHref } from '@/lib/detail-assistant';
import type { LiveLine } from '@/lib/detail-facts';
import { usableHomePhoto } from '@/lib/home-tile-previews';
import { homeGuideKey } from '@/lib/home-guide';
import { DETAIL_LABELS, ledgerContext, ledgerEssentials, ledgerMetadata, factLabel } from '@/lib/detail-ledger';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useDetailRefresh } from '@/lib/use-detail-refresh';
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
  useDetailRefresh(kind);
  const entry=catalog.entries[homeGuideKey(kind,id)],s=useScoper(),colors=useThemeColors();
  const places=useAllPlaces(),localPlace=kind==='place'?places.find(item=>item.id===id):undefined;
  const regional=useRegionalPlace(kind==='place'&&!localPlace?id:undefined);
  const place=kind==='place'?localPlace||regional.place:kind==='night'?placeForListing({name:title,address},places,activeCity()):undefined;
  const restaurant=kind==='restaurant'?RESTAURANTS[id]:place?menuListingForPlace(place,Object.values(RESTAURANTS),activeCity()):undefined,event=kind==='event'?EVENTS[id]:undefined;
  const content=place?.detailContent||event?.detailContent||(kind==='restaurant'&&RESTAURANTS[id]?placeForRestaurant(RESTAURANTS[id],places,activeCity())?.detailContent:undefined);
  const menu=restaurant?restaurantJournalMenu(restaurant,content):undefined,eventDetails=event?eventJournalDetails(event):undefined;
  const fromEntry=entry?ledgerContext(entry):null;
  const router=useRouter();
  const openPlan=(listing:DetailContext)=>router.push(detailPlanHref(listing) as never);
  const context:DetailContext={kind,id,name:title,caption:event?(eventDetails?.subtitle||event.venue):meta||fromEntry?.caption,snapshot:content?.description||(event?lede||event.know:fromEntry?.snapshot||lede),
    facts:[...detailContentFacts(content),...(menu?[{label:'Menu highlights',value:menu.items.slice(0,12).map(item=>[item.name,item.price,item.note].filter(Boolean).join(' · ')).join('\n')},...menu.specials.map(special=>({label:special.title,value:special.label+' · '+special.description}))]:[]),
      ...(event?.lineup?[{label:'Lineup',value:event.lineup}]:[]),
      ...(eventDetails?.ageLabel?[{label:'Age policy',value:eventDetails.ageLabel}]:[]),
      ...(eventDetails?.policies?[{label:'Before you go',value:eventDetails.policies.text}]:[]),
      ...(fromEntry?.facts||[]).filter(fact=>!menu||!entry?.sections?.some(section=>section.title===fact.label)),...(address?[{label:'Address',value:address}]:[]),...(live?[{label:'Right now',value:live.label}]:[]),...facts.map(fact=>({label:factLabel(fact.glyph),value:fact.label}))],
    links:[...(content?.links||[]),...(fromEntry?.links|| (sourceUrl?[{label:sourceLabel||'Official site',url:sourceUrl}]:[]))]};
  const essentials:LedgerFact[]=entry?ledgerEssentials(entry):address?[{label:'Address',value:address}]:[];
  if(live){const index=essentials.findIndex(fact=>/hours/i.test(fact.label));if(index>=0)essentials.splice(index,1);essentials.splice(Math.min(1,essentials.length),0,{label:'Right now',value:live.label,glyph:'clock'});}
  const metadata=entry?ledgerMetadata(entry):facts.filter(fact=>/dollar|wallet|route|walk|ticket/.test(fact.glyph)).slice(0,2).map(fact=>({glyph:fact.glyph,value:fact.label}));
  const chips:LedgerChip[]=(event?[]:metadata).map((fact,index)=>({key:'fact-'+index,label:['wallet','dollar'].includes(fact.glyph)?fact.value.split(' · ')[0]:fact.value,glyph:['wallet','dollar'].includes(fact.glyph)?undefined:fact.glyph}));
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
  const primaryAction:LedgerChip|undefined=actions[0]?{key:'primary',label:actions[0].label,glyph:'arrow',onPress:actions[0].onPress}:undefined;
  const isMenu=(label:string)=>kind==='restaurant'&&/menu|dish|food|drink/i.test(label);
  const folds:LedgerFold[]=rows.filter(row=>!restaurant||row.key!=='menu').map(row=>({key:row.key,label:row.label,glyph:row.glyph,chapter:isMenu(row.label)?'menu':'more',children:row.children}));
  if(eventDetails?.policies)folds.unshift({key:'policies',label:'Venue policies',glyph:'shield',children:<View style={{gap:8}}>
    <Text className="font-dm text-label text-taupe" style={{lineHeight:19}}>{eventDetails.policies.text}</Text>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Official venue policies" onPress={()=>open(eventDetails.policies!.url)} style={{minHeight:36,justifyContent:'center'}}><Text className="font-dm text-fine text-peach">Official venue policies →</Text></TouchableOpacity>
  </View>});
  if(actions.length>1||sourceUrl||heroActions||sourceNote)folds.push({key:'actions',label:kind==='restaurant'?'Menu & planning':'Links & planning',glyph:'book',children:<View style={{gap:5}}>
    {actions.slice(1).map(action=><TouchableOpacity key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={{minHeight:40,flexDirection:'row',alignItems:'center',gap:7}}>
      <Icon d={action.iconD} size={14} color={colors['surface-accent']} /><Text className="font-dm text-label text-peach">{action.label}</Text>
    </TouchableOpacity>)}
    {heroActions?<View style={{flexDirection:'row',gap:8,paddingVertical:5}}>{heroActions}</View>:null}
    {sourceUrl?<TouchableOpacity accessibilityRole="link" accessibilityLabel={sourceLabel||'Official site'} onPress={()=>open(sourceUrl)} style={{minHeight:40,flexDirection:'row',alignItems:'center',gap:7}}><Glyph name="arrow" size={14} color={colors['surface-accent']} /><Text className="font-dm text-label text-peach">{sourceLabel||'Official site'}</Text></TouchableOpacity>:null}
    {sourceNote?<Text className="font-dm text-fine text-taupe" style={{lineHeight:18}}>{sourceNote}</Text>:null}
    {typeof rating==='number'?<Text className="font-dm text-fine text-taupe">Listed rating: {rating}</Text>:null}
  </View>});
  const goods=<View style={{gap:22}}>
    {restaurant?<RestaurantJournal key={restaurant.id} restaurant={restaurant} content={content} onPlan={kind!=='restaurant'?()=>openPlan(context):undefined} />:event?<EventJournal key={event.id} event={event} />:content?<DetailGoods content={content} />:null}
    {sections.map(section=><View key={section.key} testID={'detail-section-'+section.key} style={{gap:10}}>
      {section.title?<JournalHeading title={section.title} action={section.action} onAction={section.onAction} />:null}
      {section.note?<Text className="font-dm text-fine text-taupe">{section.note}</Text>:null}
      {section.children}
      {section.footnote?<Text className="font-dm text-fine text-taupe" style={{lineHeight:18}}>{section.footnote}</Text>:null}
    </View>)}
  </View>;
  return <LedgerCompanionScreen key={kind+':'+id} context={context} image={content?.photos?.[0]?.url||usableHomePhoto(image)||entry?.image||usableHomePhoto(restaurant?.image)} glyph={entry?.glyph||'landmark'} eyebrow={DETAIL_LABELS[kind]} headingEyebrow={event?.venue}
    chips={chips} primaryAction={primaryAction} essentials={essentials} compactFacts={event?eventJournalFacts(event):undefined} folds={folds} navActive={navActive}
    journalHandlesActions={Boolean(restaurant||event)} journal={restaurant||event||content||sections.length?goods:undefined} />;
}
