import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { EventJournal, RestaurantJournal, DetailGoods, JournalHeading } from '@/components/detail-journal';
import { LedgerCompanionScreen, type LedgerChip, type LedgerFold } from '@/components/ledger-companion';
import { useRouter } from 'expo-router';
import { detailContentFacts } from '@/lib/detail-content';
import { useNow } from '@/lib/clock';
import { Photo } from '@/components/photo';
import { activeCity } from '@/lib/city';
import { detailPlanHref } from '@/lib/detail-assistant';
import type { HomeGuideEntry } from '@/lib/home-guide';
import { EVENTS, RESTAURANTS, currentEventListings } from '@/lib/data';
import { eventJournalDetails, eventJournalFacts, restaurantJournalMenu, menuListingForPlace } from '@/lib/detail-journal';
import { DETAIL_LABELS, ledgerContext, ledgerEssentials, ledgerMetadata } from '@/lib/detail-ledger';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

export function HomeEntryLedger({entry}: {entry:HomeGuideEntry}) {
  const s=useScoper(),colors=useThemeColors(),context=ledgerContext(entry),essentials=ledgerEssentials(entry),router=useRouter();
  const content=entry.detailContent;
  context.facts=[...detailContentFacts(content),...context.facts];
  const restaurant=entry.kind==='restaurant'?RESTAURANTS[entry.id]:(entry.kind==='place'||entry.kind==='night')?menuListingForPlace({id:entry.id,name:entry.name,city:entry.city,address:entry.details.find(fact=>/address/i.test(fact.label))?.value,detailContent:content},Object.values(RESTAURANTS),activeCity()):undefined,event=entry.kind==='event'?EVENTS[entry.id]:undefined;
  if(restaurant){const menu=restaurantJournalMenu(restaurant,content);context.facts=[...context.facts.filter(fact=>!entry.sections?.some(section=>section.title===fact.label)),
    {label:'Menu highlights',value:menu.items.slice(0,12).map(item=>[item.name,item.price,item.note].filter(Boolean).join(' · ')).join('\n')},...menu.specials.map(special=>({label:special.title,value:special.label+' · '+special.description}))];}
  if(event){const detail=eventJournalDetails(event);context.caption=detail.subtitle||event.venue;context.facts=[...context.facts,{label:'Lineup',value:event.lineup},...(detail.ageLabel?[{label:'Age policy',value:detail.ageLabel}]:[]),...(detail.policies?[{label:'Before you go',value:detail.policies.text}]:[])];}
  const saved=entry.saveKind?s.isSaved(entry.saveKind,entry.id):entry.planKind?s.isPlanned(entry.planKind,entry.id):false;
  const save=()=>{if(entry.saveKind)s.toggleSaved(entry.saveKind,entry.id,entry.name);else if(entry.planKind)s.togglePlan(entry.planKind,entry.id,entry.name);};
  const open=(url:string)=>{void Linking.openURL(url).catch(()=>s.showToast('Could not open that link. Please try again.'));};
  const directions=entry.links.find(link=>/^directions$|open the route/i.test(link.label));
  const chips:LedgerChip[]=(event?[]:ledgerMetadata(entry)).map((fact,index)=>({key:'fact-'+index,label:fact.value,glyph:['wallet','dollar'].includes(fact.glyph)?undefined:fact.glyph,accessibilityLabel:fact.label||fact.value}));
  if(entry.saveKind||entry.planKind)chips.push({key:'save',label:saved?'Saved':'Save',glyph:saved?'check':'bookmark',selected:saved,onPress:save,testID:'home-guide-save',accessibilityLabel:saved?`Remove ${entry.name} from ${entry.saveKind?'saved places':'plans'}`:`Save ${entry.name}`});
  if(directions)chips.push({key:'directions',label:'Directions',glyph:'navigation',accent:true,onPress:()=>open(directions.url)});
  const links=entry.links.filter(link=>link!==directions),remaining=entry.details.filter(fact=>!essentials.includes(fact));
  const primaryLink=links.find(link=>/order|reserve|book|tickets|menu/i.test(link.label));
  const primaryAction:LedgerChip|undefined=primaryLink?{key:'primary',label:primaryLink.label,glyph:'arrow',onPress:()=>open(primaryLink.url)}:undefined;
  const folds:LedgerFold[]=[];
  const policies=event?eventJournalDetails(event).policies:undefined;
  if(policies)folds.push({key:'policies',label:'Venue policies',glyph:'shield',children:<View style={{gap:8}}>
    <Text className="font-dm text-label text-taupe" style={{lineHeight:19}}>{policies.text}</Text>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Official venue policies" onPress={()=>open(policies.url)} style={{minHeight:36,justifyContent:'center'}}><Text className="font-dm text-fine text-peach">Official venue policies →</Text></TouchableOpacity>
  </View>});
  if(remaining.length)folds.push({key:'more',label:'More details',glyph:'compass',children:<View style={{gap:9}}>{remaining.map((fact,index)=><View key={index} style={{gap:3}}><Text className="font-dm text-fine text-taupe">{fact.label}</Text><Text className="font-dm text-label text-ink" style={{lineHeight:18}}>{fact.value}</Text></View>)}</View>});
  if(links.length)folds.push({key:'links',label:entry.kind==='restaurant'?'Menu & ordering':'Official links',glyph:entry.kind==='restaurant'?'book':'compass',chapter:entry.kind==='restaurant'?'menu':'more',children:<View style={{gap:4}}>{links.map(link=><TouchableOpacity key={link.url} accessibilityRole="link" accessibilityLabel={link.label} onPress={()=>open(link.url)} style={{minHeight:38,flexDirection:'row',alignItems:'center',gap:6}}>
    <Text className="font-dm text-label text-peach">{link.label}</Text><Glyph name="arrow" size={13} color={colors['surface-accent']} />
  </TouchableOpacity>)}</View>});
  const goods=<View style={{gap:22}}>
    {restaurant?<RestaurantJournal key={restaurant.id} restaurant={restaurant} content={content} onPlan={entry.kind!=='restaurant'?()=>router.push(detailPlanHref(context) as never):undefined} />:event?<EventJournal key={event.id} event={event} />:content?<DetailGoods content={content} />:null}
    {entry.kind==='venue'?<VenueListings id={entry.id} />:null}
    {!restaurant?(entry.sections||[]).map(section=><View key={section.title} style={{gap:10}}><JournalHeading title={section.title} />{section.lines.map((line,index)=><Text key={index} className="font-dm text-label text-taupe" style={{lineHeight:20}}>{line}</Text>)}</View>):null}
  </View>;
  return <LedgerCompanionScreen key={entry.kind+':'+entry.id} context={context} image={content?.photos?.[0]?.url||entry.image||restaurant?.image} glyph={entry.glyph} eyebrow={DETAIL_LABELS[entry.kind]} headingEyebrow={event?.venue}
    chips={chips} primaryAction={primaryAction} essentials={essentials} compactFacts={event?eventJournalFacts(event):undefined} folds={folds}
    journalHandlesActions={Boolean(restaurant||event)} journal={restaurant||event||content||entry.sections?.length||entry.kind==='venue'?goods:undefined} />;
}

function VenueListings({id}: {id:string}) {
  const now=useNow(),router=useRouter(),colors=useThemeColors();
  const events=currentEventListings(now).filter(event=>event.venueId===id);
  if(!events.length)return null;
  return <View testID="venue-journal-listings" style={{gap:10}}><JournalHeading title="Coming up" action={events.length>6?'See all':undefined} onAction={()=>router.push(`/venue/${encodeURIComponent(id)}`)} />
    {events.slice(0,6).map(event=><TouchableOpacity key={event.id} accessibilityRole="button" accessibilityLabel={`${event.name}. ${event.date}. ${event.priceLabel}`} onPress={()=>router.push(`/home/detail?kind=event&id=${encodeURIComponent(event.id)}`)}
      style={{paddingVertical:11,borderTopWidth:1,borderTopColor:colors['edge-faint'],flexDirection:'row',alignItems:'center',gap:11}}>
      <Photo uri={event.image} radius={9} fallbackGlyph="ticket" style={{width:52,height:48}} />
      <View style={{flex:1,minWidth:0,gap:4}}><Text numberOfLines={1} className="font-fraunces text-label text-ink">{event.name.split(/\s+/).slice(0,5).join(' ')}{event.name.split(/\s+/).length>5?'…':''}</Text><Text numberOfLines={1} className="font-dm text-fine text-taupe">{event.date.split('·')[0].trim()} · {event.time} · {event.priceLabel}</Text></View><Glyph name="arrow" size={13} color={colors['surface-accent']} />
    </TouchableOpacity>)}
  </View>;
}
