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

function PocketFacts({entry,category,caption=false}: {entry:HomeGuideEntry;category:HomeGuideCategory;caption?:boolean}) {
  const colors=useThemeColors(),summary=homeLedgerSummary(entry,category);
  const facts=caption?[{glyph:summary.glyph,value:summary.caption},...summary.facts]:summary.facts;
  return <View style={{flexDirection:'row',alignItems:'center',gap:9,minWidth:0}}>
    {facts.map((fact,index)=><View key={fact.glyph+':'+index} accessibilityLabel={fact.label || fact.value}
      style={{flexDirection:'row',alignItems:'center',gap:4,minWidth:0,flexShrink:1}}>
      <Glyph name={fact.glyph} size={12} color={colors['fg-muted']} />
      <Text testID="home-pocket-guide-fact" numberOfLines={1} ellipsizeMode="tail" className="font-dm text-fine text-taupe" style={{flexShrink:1}}>{fact.value}</Text>
    </View>)}
  </View>;
}

function PocketEntry({entry,category,lead=false}: {entry:HomeGuideEntry;category:HomeGuideCategory;lead?:boolean}) {
  const router=useRouter(),colors=useThemeColors(),surface=useRaisedSurface(1),summary=homeLedgerSummary(entry,category);
  const label=[entry.name,summary.caption,...summary.facts.map(fact=>fact.label || fact.value)].join('. ');
  return <TouchableOpacity testID={lead?'home-pocket-guide-lead':'home-pocket-guide-row'} accessibilityRole="button" accessibilityLabel={`Explore ${label}`}
    onPress={()=>router.push(homeGuideHref(entry) as never)} activeOpacity={.72}
    style={[surface,lead?{padding:14,minHeight:111,borderRadius:18,gap:8}:{flexDirection:'row',alignItems:'center',gap:11,minHeight:69,paddingVertical:11,paddingHorizontal:12,borderRadius:18}]}>
    {lead?<>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        <Glyph name="compass" size={12} color={colors['surface-accent']} />
        <Text className="font-dm text-fine uppercase" style={{letterSpacing:1.1,color:colors['surface-accent']}}>Start here</Text>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:16}}>
        <Text testID="home-pocket-guide-title" numberOfLines={1} ellipsizeMode="tail" className="min-w-0 flex-1 font-fraunces text-ink"
          style={{fontSize:25,lineHeight:28.75,letterSpacing:-.45}}>{briefTitle(entry.name)}</Text>
        <Glyph name={entry.glyph} size={29} color={colors['surface-accent']} strokeWidth={1.3} />
      </View>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-label text-taupe" style={{lineHeight:18}}>{entry.description || summary.caption}</Text>
    </>:<>
      <View style={{width:38,height:38,borderRadius:12,backgroundColor:colors['surface-sunk'],alignItems:'center',justifyContent:'center'}}>
        <Glyph name={entry.glyph} size={19} color={colors['surface-accent']} strokeWidth={1.4} />
      </View>
      <View style={{flex:1,minWidth:0,gap:5}}>
        <Text testID="home-pocket-guide-title" numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink"
          style={{fontSize:17,lineHeight:20.4,letterSpacing:-.15}}>{briefTitle(entry.name)}</Text>
        <PocketFacts entry={entry} category={category} caption />
      </View>
      <Glyph name="chevron" size={12} color={colors['surface-accent']} />
    </>}
  </TouchableOpacity>;
}

function PocketGuideContents({category,catalog,cityName,initialQuery,hydrating}: {
  category:HomeGuideCategory;catalog:HomeGuideCatalog;cityName:string;initialQuery:string;hydrating:boolean;
}) {
  const [query,setQuery]=useState(initialQuery),[filter,setFilter]=useState('all');
  const definition=HOME_LEDGERS[category];
  const entries=homeLedgerEntries(catalog,category,query,filter),filters=homeLedgerFilters(catalog.categories[category],category,filter);
  const narrowed=Boolean(query.trim()||filter!=='all');
  return <View testID={`home-pocket-guide-${category}`}>
    <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
      <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:30,lineHeight:34.5,letterSpacing:-.65}}>{definition.title}</Text>
      <Text testID="home-pocket-guide-count" accessibilityLiveRegion="polite" className="font-dm text-label text-taupe">{entries.length} {entries.length===1?definition.singular:definition.plural}</Text>
    </View>
    <Text className="font-dm text-label text-taupe" style={{marginTop:3,marginBottom:19}}>{cityName}</Text>
    <CitySearchBar testID="home-guide-search-bar" inputTestID="home-guide-search" city={cityName} value={query} onChangeText={setQuery}
      inputLabel={`Search ${definition.title} in ${cityName}`} placeholder={`${definition.search} in ${/^san francisco$/i.test(cityName)?'SF':cityName}`} />
    {filters.length>1?<View testID="home-pocket-guide-filters" style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:15}}>
      {filters.map(item=><CityChip key={item.id} testID={`home-pocket-guide-filter-${item.id}`} label={item.label} glyph={item.glyph}
        selected={filter===item.id} onPress={()=>setFilter(item.id)} />)}
    </View>:null}
    {entries.length?<View style={{marginTop:25}}>
      <PocketEntry entry={entries[0]} category={category} lead />
      {entries.length>1?<>
        <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10,marginTop:23,marginBottom:11}}>
          <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:19,lineHeight:22.8,letterSpacing:-.3}}>Also worth a look</Text>
          <Text className="font-dm text-fine text-taupe">{entries.length-1} more</Text>
        </View>
        <View style={{gap:8}}>{entries.slice(1).map(entry=><PocketEntry key={entry.kind+':'+entry.id} category={category} entry={entry} />)}</View>
      </>:null}
    </View>:<EmptyState compact title={hydrating?'Checking the city…':'Nothing here just yet'}
      message={narrowed?'Try another word or filter.':hydrating?'Local listings are loading.':`No current ${definition.plural} are listed for ${cityName}. Check back as the local catalog grows.`}
      {...(narrowed?{actionLabel:'Show all',onAction:()=>{setQuery('');setFilter('all');}}:{})} />}
  </View>;
}

/** Mounted independently by each of the four Home tile routes. */
export function HomePocketGuideScreen({category}: {category:HomeGuideCategory}) {
  const {q}=useLocalSearchParams<{q?:string|string[]}>(),{catalog,now,city}=useHomeGuide();
  const cityName=useActiveCityName(),hydrating=useContentHydrating(),query=Array.isArray(q)?q[0] || '':q || '';
  return <HomeGuideScreen now={now} backLabel="Home" search={false} context={false} header={false}>
    <PocketGuideContents key={`${city}:${category}:${query}`} category={category} catalog={catalog} cityName={cityName} initialQuery={query} hydrating={hydrating} />
  </HomeGuideScreen>;
}
