import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { CityChip, CitySearchBar } from '@/components/city-controls';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HOME_INDEX, HomeIndexRow } from '@/components/home-open-index';
import { EmptyState } from '@/components/ui';
import { useContentHydrating } from '@/lib/bootstrap';
import { type HomeGuideCatalog, type HomeGuideCategory } from '@/lib/home-guide';
import { homeIndexPhotoKey, homeIndexPhotos } from '@/lib/home-index-photos';
import { HOME_LEDGERS, homeLedgerEntries, homeLedgerFilters } from '@/lib/home-ledger';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';
import { withAlpha } from '@/lib/tokens';

function LedgerContents({category,catalog,cityName,initialQuery,hydrating}: {
  category:HomeGuideCategory;catalog:HomeGuideCatalog;cityName:string;initialQuery:string;hydrating:boolean;
}) {
  const [query,setQuery]=useState(initialQuery),[filter,setFilter]=useState('all'),[unavailablePhotos,setUnavailablePhotos]=useState<ReadonlySet<string>>(new Set());
  const colors=useThemeColors(),definition=HOME_LEDGERS[category];
  const photographed=useMemo(()=>catalog.categories[category].map(entry=>({entry,photos:homeIndexPhotos(entry,catalog)}))
    .filter(item=>item.photos.length).map(item=>({...item,key:`${item.entry.kind}:${item.entry.id}:${homeIndexPhotoKey(item.photos)}`})),[catalog,category]);
  const available=photographed.filter(item=>!unavailablePhotos.has(item.key)),inventory=available.map(item=>item.entry);
  const photoCatalog={...catalog,categories:{...catalog.categories,[category]:inventory}};
  const entries=homeLedgerEntries(photoCatalog,category,query,filter),filters=homeLedgerFilters(inventory,category,filter);
  const photosByEntry=new Map(available.map(item=>[item.entry,item]));
  const photosPending=!inventory.length&&catalog.categories[category].length>0;
  const narrowed=Boolean(query.trim()||filter!=='all');
  return <View testID={`home-ledger-${category}`}>
    <View style={{paddingTop:10}}>
      <Text accessibilityRole="header" accessibilityLabel={`${definition.title}. ${entries.length} ${entries.length===1?definition.singular:definition.plural}`} className="font-fraunces text-ink" style={{fontSize:34,lineHeight:38,letterSpacing:-.7}}>{definition.title}</Text>
    </View>
    <View style={{marginTop:14}}><CitySearchBar testID="home-guide-search-bar" inputTestID="home-guide-search" city={cityName} value={query} onChangeText={setQuery}
      inputLabel={`Search ${definition.title} in ${cityName}`} placeholder={`${definition.search} in ${/^san francisco$/i.test(cityName)?'SF':cityName}`} /></View>
    {filters.length>1?<ScrollView testID="home-ledger-filters" horizontal showsHorizontalScrollIndicator={false} style={{marginTop:10}} contentContainerStyle={{gap:6,paddingBottom:4}}>
      {filters.map(item=><CityChip key={item.id} testID={`home-ledger-filter-${item.id}`} label={item.label} borderless
        selected={filter===item.id} onPress={()=>setFilter(item.id)} />)}
    </ScrollView>:null}
    {entries.length?<View testID="home-result-list" style={{marginTop:14,gap:HOME_INDEX.gap,marginHorizontal:-14,paddingHorizontal:14,backgroundColor:withAlpha(colors['surface-control'],.3)}}>
      {entries.map((entry,index)=>{const item=photosByEntry.get(entry)!;return <HomeIndexRow key={item.key} entry={entry} category={category} index={index} photos={item.photos}
        onPhotoUnavailable={()=>setUnavailablePhotos(previous=>new Set(previous).add(item.key))} />;})}
    </View>:<EmptyState compact title={hydrating?'Checking the city…':photosPending?'More photos on the way':'Nothing here just yet'}
      message={narrowed?'Try another word or filter.':hydrating?'Local listings are loading.':photosPending?'Photos are still being collected for these local listings.':`No current ${definition.plural} are listed for ${cityName}. Check back as the local catalog grows.`}
      {...(narrowed?{actionLabel:'Show all',onAction:()=>{setQuery('');setFilter('all');}}:{})} />}
  </View>;
}

/** Mounted independently by each of the four Home tile routes. */
export function HomeLedgerScreen({category}: {category:HomeGuideCategory}) {
  const {q}=useLocalSearchParams<{q?:string|string[]}>(),{catalog,now,city,displayCity}=useHomeGuide();
  const cityName=displayCity,hydrating=useContentHydrating(),query=Array.isArray(q)?q[0] || '':q || '';
  return <HomeGuideScreen now={now} backLabel="Home" search={false} context={false} header={false}>
    <LedgerContents key={`${city}:${category}:${query}`} category={category} catalog={catalog} cityName={cityName} initialQuery={query} hydrating={hydrating} />
  </HomeGuideScreen>;
}
