import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { CityChip, CitySearchBar } from '@/components/city-controls';
import { Glyph } from '@/components/glyph';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HomePoster, HomeResultCard } from '@/components/home-secondary';
import { HOME_RESULT, homeMenuItems } from '@/lib/home-secondary';
import { DetailAssistantDock } from '@/components/detail-assistant';
import { ledgerContext } from '@/lib/detail-ledger';
import { EmptyState } from '@/components/ui';
import { useContentHydrating } from '@/lib/bootstrap';
import { homeGuideKey, type HomeGuideCatalog, type HomeGuideCategory } from '@/lib/home-guide';
import { HOME_LEDGERS, homeLedgerEntries, homeLedgerFilters } from '@/lib/home-ledger';
import { useThemeColors } from '@/lib/theme';
import { useControlSurface } from '@/lib/shadows';
import { useHomeGuide } from '@/lib/use-home-guide';

function LedgerContents({category,catalog,cityName,initialQuery,hydrating,onLeadChange}: {
  category:HomeGuideCategory;catalog:HomeGuideCatalog;cityName:string;initialQuery:string;hydrating:boolean;onLeadChange:(key:string)=>void;
}) {
  const [query,setQuery]=useState(initialQuery),[filter,setFilter]=useState('all');
  const router=useRouter(),colors=useThemeColors(),control=useControlSurface(),definition=HOME_LEDGERS[category];
  const entries=homeLedgerEntries(catalog,category,query,filter),filters=homeLedgerFilters(catalog.categories[category],category,filter);
  const narrowed=Boolean(query.trim()||filter!=='all');
  const richIndex=category==='eat'?entries.findIndex(entry=>homeMenuItems(entry).some(item=>item.image)):-1;
  const lead=entries[richIndex<0?0:richIndex],rest=entries.filter(entry=>entry!==lead);
  const leadKey=lead?homeGuideKey(lead.kind,lead.id):'';
  useEffect(()=>onLeadChange(leadKey),[leadKey,onLeadChange]);
  return <View testID={`home-ledger-${category}`}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Home" onPress={()=>router.canGoBack()?router.back():router.replace('/')} style={[control,{width:34,height:34,justifyContent:'center',alignItems:'center',borderRadius:17}]}><Glyph name="chevronLeft" size={16} color={colors.fg} /></TouchableOpacity>
      <Text className="font-dm text-fine text-taupe">{cityName}</Text>
      <View style={{width:34}} />
    </View>
    <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10,paddingTop:10}}>
      <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:30,lineHeight:34.5,letterSpacing:-.65}}>{definition.title}</Text>
      <Text testID="home-ledger-count" accessibilityLiveRegion="polite" className="font-dm text-label text-taupe">{entries.length} {entries.length===1?definition.singular:definition.plural}</Text>
    </View>
    <View style={{height:14}} />
    <CitySearchBar testID="home-guide-search-bar" inputTestID="home-guide-search" city={cityName} value={query} onChangeText={setQuery}
      inputLabel={`Search ${definition.title} in ${cityName}`} placeholder={`${definition.search} in ${/^san francisco$/i.test(cityName)?'SF':cityName}`} />
    {filters.length>1?<View testID="home-ledger-filters" style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:15}}>
      {filters.map(item=><CityChip key={item.id} testID={`home-ledger-filter-${item.id}`} label={item.label} glyph={item.glyph}
        selected={filter===item.id} onPress={()=>setFilter(item.id)} />)}
    </View>:null}
    {lead?<View testID="home-result-list" style={{marginTop:18,gap:HOME_RESULT.gap}}>
      <HomePoster entry={lead} category={category} />
      {rest.map(entry=><HomeResultCard key={entry.kind+':'+entry.id} entry={entry} />)}
    </View>:<EmptyState compact title={hydrating?'Checking the city…':'Nothing here just yet'}
      message={narrowed?'Try another word or filter.':hydrating?'Local listings are loading.':`No current ${definition.plural} are listed for ${cityName}. Check back as the local catalog grows.`}
      {...(narrowed?{actionLabel:'Show all',onAction:()=>{setQuery('');setFilter('all');}}:{})} />}
  </View>;
}

/** Mounted independently by each of the four Home tile routes. */
export function HomeLedgerScreen({category}: {category:HomeGuideCategory}) {
  const {q}=useLocalSearchParams<{q?:string|string[]}>(),{catalog,now,city,displayCity}=useHomeGuide();
  const cityName=displayCity,hydrating=useContentHydrating(),query=Array.isArray(q)?q[0] || '':q || '';
  const [leadKey,setLeadKey]=useState(''),first=catalog.entries[leadKey]||catalog.categories[category][0];
  return <HomeGuideScreen now={now} backLabel="Home" search={false} context={false} header={false} beforeNav={first?<DetailAssistantDock chevron context={ledgerContext(first)} />:undefined}>
    <LedgerContents key={`${city}:${category}:${query}`} category={category} catalog={catalog} cityName={cityName} initialQuery={query} hydrating={hydrating} onLeadChange={setLeadKey} />
  </HomeGuideScreen>;
}
