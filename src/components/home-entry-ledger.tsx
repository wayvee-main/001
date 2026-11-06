import { shortCardTitle } from '@/lib/card-presentation';
import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { PerksEveningAction } from '@/components/local-perks';
import { EventJournal, RestaurantJournal, DetailGoods, JournalHeading } from '@/components/detail-journal';
import { LedgerCompanionScreen, type LedgerChip, type LedgerFold } from '@/components/ledger-companion';
import { useRouter } from 'expo-router';
import { detailContentFacts } from '@/lib/detail-content';
import { useNow } from '@/lib/clock';
import { activeCity } from '@/lib/city';
import { detailPlanHref } from '@/lib/detail-assistant';
import { homeGuideHref, homeGuideKey, type HomeGuideEntry } from '@/lib/home-guide';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import { dateLead, stopLead } from '@/lib/stub-cards';
import { useHomeGuide } from '@/lib/use-home-guide';
import { StubPoster, StubRail, StubStack, StubTicket } from '@/components/stub-cards';
import { CRAWLS, EVENTS, RESTAURANTS, currentEventListings } from '@/lib/data';
import { eventJournalDetails, eventJournalFacts, restaurantJournalMenu, menuListingForPlace } from '@/lib/detail-journal';
import { DETAIL_LABELS, ledgerContext, ledgerEssentials, ledgerMetadata } from '@/lib/detail-ledger';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

export function HomeEntryLedger({entry,initialDish}: {entry:HomeGuideEntry;initialDish?:string}) {
  const s=useScoper(),colors=useThemeColors(),context=ledgerContext(entry),essentials=ledgerEssentials(entry),router=useRouter();
  const content=entry.detailContent;
  context.facts=[...detailContentFacts(content),...context.facts];
  const restaurant=entry.kind==='restaurant'?RESTAURANTS[entry.id]:(entry.kind==='place'||entry.kind==='night'||entry.kind==='venue')?menuListingForPlace({id:entry.id,name:entry.name,city:entry.city,address:entry.details.find(fact=>/address/i.test(fact.label))?.value,detailContent:content},Object.values(RESTAURANTS),activeCity()):undefined,event=entry.kind==='event'?EVENTS[entry.id]:undefined;
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
    {restaurant?<RestaurantJournal key={restaurant.id} restaurant={restaurant} content={content} initialDish={initialDish} onPlan={entry.kind!=='restaurant'?()=>router.push(detailPlanHref(context) as never):undefined} />:event?<EventJournal key={event.id} event={event} />:content?<DetailGoods content={content} />:null}
    {entry.kind==='venue'?<VenueListings id={entry.id} />:null}
    {entry.kind==='crawl'?<CrawlStops id={entry.id} />:null}
    {!restaurant&&entry.kind!=='crawl'?(entry.sections||[]).map(section=><View key={section.title} style={{gap:10}}><JournalHeading title={section.title} />{section.lines.map((line,index)=><Text key={index} className="font-dm text-label text-taupe" style={{lineHeight:20}}>{line}</Text>)}</View>):null}
  </View>;
  return <LedgerCompanionScreen key={entry.kind+':'+entry.id} context={context} image={content?.photos?.[0]?.url||entry.image||restaurant?.image}
    photos={[...(content?.photos||[]).slice(0,5).map(photo=>({source:photo.url,label:photo.caption||`Photo from ${entry.name}`})),
      ...[entry.image,restaurant?.image].flatMap(source=>source?[{source,label:`Photo from ${entry.name}`}]:[])]} glyph={entry.glyph} eyebrow={DETAIL_LABELS[entry.kind]} headingEyebrow={event?.venue}
    chips={chips} primaryAction={primaryAction} essentials={essentials} compactFacts={event?eventJournalFacts(event):undefined} folds={folds}
    journalHandlesActions={Boolean(restaurant||event)} journal={restaurant||event||content||entry.sections?.length||entry.kind==='venue'?goods:undefined}><PerksEveningAction entry={entry} /></LedgerCompanionScreen>;
}

function VenueListings({id}: {id:string}) {
  const now=useNow(),router=useRouter(),{catalog}=useHomeGuide();
  const events=currentEventListings(now).filter(event=>event.venueId===id);
  const nearby=catalog.collections.find(collection=>collection.venueId===id);
  const places=(nearby?.items||[]).flatMap(item=>{const entry=catalog.entries[homeGuideKey(item.type,item.id)];return entry?[{entry,note:item.note}]:[];});
  if(!events.length&&!places.length)return null;
  return <View style={{gap:26}}>
    {events.length?<View testID="venue-journal-listings" style={{gap:10}}><JournalHeading title="Coming up" action={events.length>6?'See all':undefined} onAction={()=>router.push(`/venue/${encodeURIComponent(id)}`)} />
      <StubStack>{events.slice(0,6).map(event=><StubTicket key={event.id} testID="venue-listing" lead={dateLead(event.startsAt)||{kind:'thumb'}} title={shortCardTitle(event.name)}
        caption={event.date.split('·').slice(1).map(part=>part.trim()).filter(Boolean).join(' · ')||event.time} accent={event.priceLabel}
        photo={{uri:event.image,glyph:'ticket',label:`No photo for ${event.name}`}} width="full"
        onPress={()=>router.push(`/home/detail?kind=event&id=${encodeURIComponent(event.id)}`)} accessibilityLabel={`${event.name}. ${event.date}. ${event.priceLabel}`} />)}</StubStack>
    </View>:null}
    {nearby&&places.length?<View testID="venue-before-the-show" style={{gap:10}}><JournalHeading title={nearby.shortTitle||nearby.title} action="See all" onAction={()=>router.push(`/home/collection?id=${encodeURIComponent(nearby.id)}` as never)} />
      <StubRail>{places.map(({entry,note})=>{const restaurant=entry.kind==='restaurant'?RESTAURANTS[entry.id]:undefined;
        return <StubPoster key={entry.kind+':'+entry.id} title={entry.name} caption={note||entry.caption}
          pills={[...(restaurant?.distanceLabel?[{text:restaurant.distanceLabel,glyph:'walk'}]:[]),...(restaurant?.price?[{text:restaurant.price}]:[])]}
          photo={{candidates:homeIndexPhotos(entry,catalog),glyph:entry.glyph,label:`${entry.name} photo unavailable`}}
          onPress={()=>router.push(homeGuideHref(entry) as never)} accessibilityLabel={[entry.name,note,restaurant?.distanceLabel].filter(Boolean).join('. ')} />;})}</StubRail>
    </View>:null}
  </View>;
}

/** A route's stops in walking order as numbered tickets, then the other routes. */
function CrawlStops({id}: {id:string}) {
  const router=useRouter(),{catalog}=useHomeGuide(),crawl=CRAWLS[id];
  if(!crawl)return null;
  const byName=new Map(Object.values(catalog.entries).map(entry=>[entry.name,entry]));
  const others=Object.values(CRAWLS).filter(route=>route.id!==id);
  return <View style={{gap:26}}>
    <View testID="crawl-stops" style={{gap:10}}><JournalHeading title="The route" />
      <StubStack>{crawl.stops.map((stop,index)=>{const [where,...what]=stop.note.split(' · '),entry=byName.get(stop.name),kind=what.join(' · ');
        return <StubTicket key={stop.name} testID="crawl-stop" lead={stopLead(index,crawl.stops.length)} title={stop.name} caption={kind?kind.charAt(0).toUpperCase()+kind.slice(1):undefined} accent={where}
          photo={entry?{candidates:homeIndexPhotos(entry,catalog),glyph:entry.glyph,label:`${stop.name} photo unavailable`}:undefined} width="full"
          onPress={()=>entry?router.push(homeGuideHref(entry) as never):Linking.openURL(crawl.routeUrl)} accessibilityLabel={`Stop ${index+1}. ${stop.name}. ${stop.note}`} />;})}</StubStack>
    </View>
    {others.length?<View style={{gap:10}}><JournalHeading title="More routes" />
      <StubRail>{others.map(route=>{const distance=route.meta.match(/(?:under\s+)?\d+(?:\.\d+)?\s*mi\b/i)?.[0],ride=/ride/i.test(route.meta);
        return <StubTicket key={route.id} lead={{kind:'thumb'}} title={route.name} caption={route.stops.map(stop=>stop.name).join(' → ')}
          pills={[{text:`${route.stops.length} stops`,glyph:'route'},...(ride?[{text:'Rides',glyph:'car'}]:distance?[{text:distance,glyph:'walk'}]:[])]}
          photo={{glyph:'route',label:route.name}} onPress={()=>router.push(`/home/detail?kind=crawl&id=${encodeURIComponent(route.id)}` as never)} accessibilityLabel={`${route.name}. ${route.meta}`} />;})}</StubRail>
    </View>:null}
  </View>;
}
