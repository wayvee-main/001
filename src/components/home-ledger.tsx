import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { CityChip, CitySearchBar } from '@/components/city-controls';
import { Glyph } from '@/components/glyph';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { EmptyState } from '@/components/ui';
import { useContentHydrating } from '@/lib/bootstrap';
import { useActiveCityName } from '@/lib/city';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { HOME_LEDGERS, homeLedgerEntries, homeLedgerFilters, homeLedgerSummary } from '@/lib/home-ledger';
import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

const briefTitle=(title:string)=>{const words=title.trim().split(/\s+/);return words.length>5?words.slice(0,5).join(' ')+'…':title;};

function LedgerLead({entry,category}: {entry:HomeGuideEntry;category:HomeGuideCategory}) {
  const router=useRouter(),colors=useThemeColors(),surface=useRaisedSurface(1),summary=homeLedgerSummary(entry,category);
  const label=[entry.name,summary.caption,...summary.facts.map(fact=>fact.label || fact.value)].join('. ');
  return <TouchableOpacity testID="home-ledger-lead" accessibilityRole="button" accessibilityLabel={`Start here. Explore ${label}`}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.72}
    style={[surface,{paddingHorizontal:14,paddingVertical:12,minHeight:111,borderRadius:18,gap:7}]}>
    <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
      <Glyph name="compass" size={12} color={colors['surface-accent']} />
      <Text className="font-dm text-fine uppercase" style={{letterSpacing:1.1,color:colors['surface-accent']}}>Start here</Text>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
      <Text testID="home-ledger-title" numberOfLines={1} ellipsizeMode="tail" className="min-w-0 flex-1 font-fraunces text-ink"
        style={{fontSize:23,lineHeight:27,letterSpacing:-.4}}>{briefTitle(entry.name)}</Text>
      <Glyph name={entry.glyph} size={23} color={colors['surface-accent']} strokeWidth={1.3} />
    </View>
    <Text numberOfLines={2} ellipsizeMode="tail" className="font-dm text-label text-taupe" style={{lineHeight:17}}>{entry.description || summary.caption}</Text>
  </TouchableOpacity>;
}

function LedgerRow({entry,category,index}: {entry:HomeGuideEntry;category:HomeGuideCategory;index:number}) {
  const router=useRouter(),colors=useThemeColors(),summary=homeLedgerSummary(entry,category);
  const label=[entry.name,summary.caption,...summary.facts.map(fact=>fact.label || fact.value)].join('. ');
  return <TouchableOpacity testID="home-ledger-row" accessibilityRole="button" accessibilityLabel={`Explore ${label}`}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.72}
    style={{flexDirection:'row',alignItems:'flex-start',gap:8,minHeight:74,paddingVertical:15,borderBottomWidth:1,borderBottomColor:colors['edge-faint']}}>
    <Text accessibilityElementsHidden importantForAccessibility="no" className="font-dm text-meta"
      style={{width:22,paddingTop:2,color:colors['surface-accent'],fontVariant:['tabular-nums']}}>{String(index+1).padStart(2,'0')}</Text>
    <View style={{flex:1,minWidth:0,gap:4}}>
      <Text testID="home-ledger-title" numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink"
        style={{fontSize:18,lineHeight:21,letterSpacing:-.3}}>{briefTitle(entry.name)}</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:5,minWidth:0}}>
        <Glyph name={summary.glyph} size={11} color={colors['fg-muted']} />
        <Text numberOfLines={1} ellipsizeMode="tail" className="min-w-0 flex-1 font-dm text-meta text-taupe">{summary.caption}</Text>
      </View>
    </View>
    {summary.facts.length?<View style={{width:72,maxWidth:'26%',alignItems:'flex-end',gap:4,paddingTop:2}}>
      {summary.facts.map((fact,i)=><Text key={fact.glyph+':'+i} testID="home-ledger-fact" accessibilityLabel={fact.label || fact.value}
        numberOfLines={category==='bars'?2:1} ellipsizeMode="tail" className={`font-dm ${i===0?'text-label text-ink':'text-meta text-taupe'}`}
        style={{maxWidth:'100%',textAlign:'right'}}>{fact.value}</Text>)}
    </View>:null}
  </TouchableOpacity>;
}

function LedgerContents({category,catalog,cityName,initialQuery,hydrating}: {
  category:HomeGuideCategory;catalog:HomeGuideCatalog;cityName:string;initialQuery:string;hydrating:boolean;
}) {
  const [query,setQuery]=useState(initialQuery),[filter,setFilter]=useState('all');
  const definition=HOME_LEDGERS[category];
  const entries=homeLedgerEntries(catalog,category,query,filter),filters=homeLedgerFilters(catalog.categories[category],category,filter);
  const narrowed=Boolean(query.trim()||filter!=='all');
  return <View testID={`home-ledger-${category}`}>
    <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10,paddingTop:10}}>
      <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:30,lineHeight:34.5,letterSpacing:-.65}}>{definition.title}</Text>
      <Text testID="home-ledger-count" accessibilityLiveRegion="polite" className="font-dm text-label text-taupe">{entries.length} {entries.length===1?definition.singular:definition.plural}</Text>
    </View>
    <Text className="font-dm text-label text-taupe" style={{marginTop:3,marginBottom:19}}>{cityName}</Text>
    <CitySearchBar testID="home-guide-search-bar" inputTestID="home-guide-search" city={cityName} value={query} onChangeText={setQuery}
      inputLabel={`Search ${definition.title} in ${cityName}`} placeholder={`${definition.search} in ${/^san francisco$/i.test(cityName)?'SF':cityName}`} />
    {filters.length>1?<View testID="home-ledger-filters" style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:15}}>
      {filters.map(item=><CityChip key={item.id} testID={`home-ledger-filter-${item.id}`} label={item.label} glyph={item.glyph}
        selected={filter===item.id} onPress={()=>setFilter(item.id)} />)}
    </View>:null}
    {entries.length?<View style={{marginTop:25}}>
      <LedgerLead entry={entries[0]} category={category} />
      {entries.length>1?<>
        <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:18,lineHeight:22,letterSpacing:-.3,marginTop:22,marginBottom:7}}>The short list</Text>
        {entries.slice(1).map((entry,index)=><LedgerRow key={entry.kind+':'+entry.id} category={category} entry={entry} index={index+1} />)}
      </>:null}
    </View>:<EmptyState compact title={hydrating?'Checking the city…':'Nothing here just yet'}
      message={narrowed?'Try another word or filter.':hydrating?'Local listings are loading.':`No current ${definition.plural} are listed for ${cityName}. Check back as the local catalog grows.`}
      {...(narrowed?{actionLabel:'Show all',onAction:()=>{setQuery('');setFilter('all');}}:{})} />}
  </View>;
}

/** Mounted independently by each of the four Home tile routes. */
export function HomeLedgerScreen({category}: {category:HomeGuideCategory}) {
  const {q}=useLocalSearchParams<{q?:string|string[]}>(),{catalog,now,city}=useHomeGuide();
  const cityName=useActiveCityName(),hydrating=useContentHydrating(),query=Array.isArray(q)?q[0] || '':q || '';
  return <HomeGuideScreen now={now} backLabel="Home" search={false} context={false} header={false}>
    <LedgerContents key={`${city}:${category}:${query}`} category={category} catalog={catalog} cityName={cityName} initialQuery={query} hydrating={hydrating} />
  </HomeGuideScreen>;
}
