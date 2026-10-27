import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { CityChip, CitySearchBar } from '@/components/city-controls';
import { Glyph } from '@/components/glyph';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HOME_INDEX, HomeIndexRow } from '@/components/home-open-index';
import { EmptyState } from '@/components/ui';
import { useContentHydrating } from '@/lib/bootstrap';
import { type HomeGuideCatalog, type HomeGuideCategory } from '@/lib/home-guide';
import { homeIndexPhotoKey, homeIndexPhotos } from '@/lib/home-index-photos';
import { HOME_LEDGERS, homeLedgerEntries, homeLedgerFilters } from '@/lib/home-ledger';
import { useThemeColors } from '@/lib/theme';
import { useControlSurface } from '@/lib/shadows';
import { useHomeGuide } from '@/lib/use-home-guide';

function LedgerContents({category,catalog,cityName,initialQuery,hydrating}: {
  category:HomeGuideCategory;catalog:HomeGuideCatalog;cityName:string;initialQuery:string;hydrating:boolean;
}) {
  const [query,setQuery]=useState(initialQuery),[filter,setFilter]=useState('all'),[unavailablePhotos,setUnavailablePhotos]=useState<ReadonlySet<string>>(new Set());
  const [searchOpen,setSearchOpen]=useState(Boolean(initialQuery.trim()));
  const router=useRouter(),colors=useThemeColors(),control=useControlSurface(),definition=HOME_LEDGERS[category];
  const photographed=useMemo(()=>catalog.categories[category].map(entry=>({entry,photos:homeIndexPhotos(entry,catalog)}))
    .filter(item=>item.photos.length).map(item=>({...item,key:`${item.entry.kind}:${item.entry.id}:${homeIndexPhotoKey(item.photos)}`})),[catalog,category]);
  const available=photographed.filter(item=>!unavailablePhotos.has(item.key)),inventory=available.map(item=>item.entry);
  const photoCatalog={...catalog,categories:{...catalog.categories,[category]:inventory}};
  const entries=homeLedgerEntries(photoCatalog,category,query,filter),filters=homeLedgerFilters(inventory,category,filter);
  const photosByEntry=new Map(available.map(item=>[item.entry,item]));
  const photosPending=!inventory.length&&catalog.categories[category].length>0;
  const narrowed=Boolean(query.trim()||filter!=='all');
  return <View testID={`home-ledger-${category}`} style={{paddingTop:6}}>
    <View testID="home-ledger-toolbar" style={{height:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Home" onPress={()=>router.canGoBack()?router.back():router.replace('/')} style={[control,{width:36,height:36,justifyContent:'center',alignItems:'center',borderRadius:18,borderWidth:0}]}><Glyph name="chevronLeft" size={16} color={colors.fg} /></TouchableOpacity>
      <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{letterSpacing:.8,textTransform:'uppercase',flexShrink:1}}>{cityName} · {definition.title}</Text>
      <TouchableOpacity testID="home-ledger-search-toggle" accessibilityRole="button" accessibilityLabel={searchOpen?'Close category search':`Search ${definition.title}`} accessibilityState={{expanded:searchOpen}}
        onPress={()=>{if(searchOpen){setQuery('');Keyboard.dismiss();}setSearchOpen(value=>!value);}}
        style={[control,{width:36,height:36,justifyContent:'center',alignItems:'center',borderRadius:18,borderWidth:0}]}><Glyph name={searchOpen?'close':'search'} size={16} color={colors.fg} /></TouchableOpacity>
    </View>
    <View style={{marginTop:17,marginBottom:10,flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:12}}>
      <Text accessibilityRole="header" accessibilityLabel={`${definition.title}. ${entries.length} ${entries.length===1?definition.singular:definition.plural}`} className="font-fraunces text-ink" style={{fontSize:34,lineHeight:39,letterSpacing:-.7}}>{definition.title}</Text>
      <Text testID="home-ledger-count" className="font-dm text-fine text-taupe">{entries.length} {entries.length===1?definition.singular:definition.plural}</Text>
    </View>
    {searchOpen?<View style={{marginTop:3,marginBottom:12}}><CitySearchBar autoFocus testID="home-guide-search-bar" inputTestID="home-guide-search" city={cityName} value={query} onChangeText={setQuery}
      inputLabel={`Search ${definition.title} in ${cityName}`} placeholder={`${definition.search} in ${/^san francisco$/i.test(cityName)?'SF':cityName}`} /></View>:null}
    {filters.length>1?<ScrollView testID="home-ledger-filters" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingBottom:3}}>
      {filters.map(item=><CityChip key={item.id} testID={`home-ledger-filter-${item.id}`} label={item.label} borderless
        selected={filter===item.id} onPress={()=>setFilter(item.id)} />)}
    </ScrollView>:null}
    {entries.length?<View testID="home-result-list" style={{marginTop:19,gap:HOME_INDEX.gap}}>
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
