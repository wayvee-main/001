import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CitySearchBar } from '@/components/city-controls';
import { Glyph } from '@/components/glyph';
import { Screen, ScreenScroll } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { VeeMark } from '@/components/vee-mark';
import { useActiveCityName } from '@/lib/city';
import { useContentHydrating } from '@/lib/bootstrap';
import { recordRestaurantExploration } from '@/lib/exploration-history';
import { buildHomeSearchIndex, homeGuideHref, homeGuideHrefFromLegacy, type HomeGuideEntry } from '@/lib/home-guide';
import { clearRecentSearches, loadRecentSearches, recordRecentSearch, type RecentSearch } from '@/lib/recent-searches';
import { queryIndex, type SearchResult } from '@/lib/search';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

type Scope = 'all' | 'places' | 'shows' | 'routes';
type Browse = 'food' | 'bars' | 'shows' | 'outdoors';
const SCOPES: {key:Scope;label:string}[] = [
  {key:'all',label:'All'},{key:'places',label:'Places'},{key:'shows',label:'Shows'},{key:'routes',label:'Routes'},
];
const BROWSE: {key:Browse;label:string;glyph:string;scope:Scope}[] = [
  {key:'food',label:'Food & coffee',glyph:'food',scope:'places'},
  {key:'bars',label:'Drinks',glyph:'drink',scope:'places'},
  {key:'shows',label:'Live music',glyph:'ticket',scope:'shows'},
  {key:'outdoors',label:'Outdoors',glyph:'hike',scope:'routes'},
];
const queryHref=(query:string)=>'/search?q='+encodeURIComponent(query);

function matchesScope(entry:HomeGuideEntry,scope:Scope):boolean {
  if(scope==='all')return true;
  if(scope==='places')return ['restaurant','place','night'].includes(entry.kind);
  if(scope==='shows')return entry.kind==='event'||entry.kind==='venue';
  return ['crawl','outdoor','pick'].includes(entry.kind);
}
function matchesBrowse(entry:HomeGuideEntry,browse:Browse|null):boolean {
  if(!browse)return true;
  if(browse==='food')return entry.kind==='restaurant'||entry.kind==='place'&&['restaurant','cafe','bakery'].includes(entry.category||'');
  if(browse==='bars')return entry.kind==='night'||entry.kind==='place'&&['bar','pub','wine_bar','brewery','night_club'].includes(entry.category||'');
  if(browse==='shows')return entry.kind==='event'||entry.kind==='venue';
  return entry.kind==='outdoor'||entry.kind==='crawl';
}

function IndexRow({title,subtitle,glyph,onPress,testID}:{title:string;subtitle?:string;glyph:string;onPress:()=>void;testID?:string}) {
  const colors=useThemeColors();
  return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={[title,subtitle].filter(Boolean).join('. ')}
    activeOpacity={.72} onPress={onPress} style={{minHeight:subtitle?65:51,borderBottomWidth:1,borderBottomColor:colors['edge-faint'],
      flexDirection:'row',alignItems:'center',gap:11,paddingVertical:11}}>
    <Glyph name={glyph} size={15} color={colors['fg-muted']} />
    <View className="min-w-0 flex-1">
      <Text numberOfLines={1} className="font-dm-medium text-body-strong text-ink">{title}</Text>
      {subtitle?<Text numberOfLines={1} className="mt-0.5 font-dm text-fine text-taupe">{subtitle}</Text>:null}
    </View>
    <Glyph name="chevron" size={12} color={colors['fg-muted']} />
  </TouchableOpacity>;
}

/** Quiet index: one dedicated search route shared by the app's launchers. */
export default function SearchScreen() {
  const params=useLocalSearchParams<{q?:string}>(),router=useRouter(),colors=useThemeColors(),cityName=useActiveCityName();
  const {catalog,city}=useHomeGuide(),hydrating=useContentHydrating();
  const tasteTags=useScoper(s=>s.tasteTags),showToast=useScoper(s=>s.showToast);
  const [query,setQuery]=useState(params.q||''),[scope,setScope]=useState<Scope>('all'),[browse,setBrowse]=useState<Browse|null>(null);
  const [recent,setRecent]=useState<RecentSearch[]>([]),[page,setPage]=useState({key:'',limit:12});
  const nextSeed=city+':'+(params.q||''),[seed,setSeed]=useState(nextSeed);
  if(seed!==nextSeed){setSeed(nextSeed);setQuery(params.q||'');setScope('all');setBrowse(null);}
  const pageKey=[city,query,scope,browse].join(':'),limit=page.key===pageKey?page.limit:12;
  const inputRef=useRef<TextInput>(null);
  useFocusEffect(useCallback(()=>{
    let active=true;
    void loadRecentSearches().then(entries=>{if(active)setRecent(entries);}).catch(()=>undefined);
    return ()=>{active=false;};
  },[]));

  const index=buildHomeSearchIndex(catalog),entriesByHref=new Map(Object.values(catalog.entries).map(entry=>[homeGuideHref(entry),entry]));
  const trimmed=query.trim(),searching=Boolean(trimmed||browse||scope!=='all');
  const ranked:SearchResult[]=trimmed?queryIndex(index,trimmed,tasteTags):searching?index.map(entry=>({...entry,score:0})):[];
  const matches=ranked.filter(result=>{const entry=entriesByHref.get(result.href);return entry&&matchesScope(entry,scope)&&matchesBrowse(entry,browse);});
  const recentHere=recent.filter(entry=>(!entry.city||entry.city===city)&&(entry.query||entriesByHref.has(homeGuideHrefFromLegacy(entry.href)))).slice(0,3);
  const remember=(entry:RecentSearch)=>{
    void recordRecentSearch({...entry,city}).then(setRecent).catch(()=>undefined);
  };
  const submit=(text:string)=>{if(text)remember({label:text,query:text,href:queryHref(text)});};
  const openResult=(result:SearchResult)=>{
    Keyboard.dismiss();
    remember(trimmed?{label:trimmed,query:trimmed,href:queryHref(trimmed)}:{label:result.title,href:result.href});
    const entry=entriesByHref.get(result.href);
    if(entry?.kind==='restaurant')void recordRestaurantExploration({href:'/restaurant/'+entry.id,label:entry.name});
    router.push(result.href as never);
  };
  const openRecent=(entry:RecentSearch)=>{
    remember(entry);
    if(entry.query){setQuery(entry.query);setScope('all');setBrowse(null);Keyboard.dismiss();}
    else router.push(homeGuideHrefFromLegacy(entry.href) as never);
  };
  const clearHistory=async()=>{
    try{await clearRecentSearches();setRecent([]);}catch{showToast('Could not clear recent searches. Try again.');}
  };
  const reset=()=>{setQuery('');setScope('all');setBrowse(null);inputRef.current?.focus();};

  return <Screen><ScreenScroll gap={0} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <View testID="search-page" style={{paddingTop:4}}>
      <View className="mb-[17px] flex-row items-center justify-between">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" activeOpacity={.7}
          onPress={()=>{Keyboard.dismiss();if(router.canGoBack())router.back();else router.replace('/');}}
          style={{minHeight:44,minWidth:44,flexDirection:'row',alignItems:'center',gap:6}}>
          <Glyph name="back" size={17} color={colors['fg-muted']} /><Text className="font-dm text-label text-taupe">Back</Text>
        </TouchableOpacity><VeeMark size={25} />
      </View>
      <View className="mb-[19px] flex-row items-baseline justify-between gap-x-3">
        <Text accessibilityRole="header" className="font-fraunces text-ink" style={{fontSize:26,lineHeight:31.2,letterSpacing:-.35}}>Search</Text>
        <Text testID="search-page-city" className="font-dm text-label text-taupe">{cityName}</Text>
      </View>
      <CitySearchBar testID="search-page-bar" city={cityName} inputLabel={`Search ${cityName}`} placeholder="Places, artists, or an idea"
        inputRef={inputRef} autoFocus value={query} onChangeText={setQuery} onSubmit={submit} />

      {searching?<View style={{marginTop:15}}>
        <View className="flex-row gap-x-[18px]" style={{borderBottomWidth:1,borderBottomColor:colors['edge-faint'],marginBottom:20}}>
          {SCOPES.map(item=><TouchableOpacity key={item.key} accessibilityRole="button" accessibilityState={{selected:scope===item.key}}
            onPress={()=>{setScope(item.key);setBrowse(null);}} testID={`search-scope-${item.key}`}
            style={{minHeight:44,minWidth:44,justifyContent:'center',borderBottomWidth:2,borderBottomColor:scope===item.key?colors['accent-fill']:'transparent'}}>
            <Text className="font-dm text-label" style={{color:scope===item.key?colors.fg:colors['fg-muted']}}>{item.label}</Text>
          </TouchableOpacity>)}
        </View>
        <View className="mb-1 flex-row items-baseline justify-between gap-x-2">
          <Text className="font-fraunces text-section text-ink">{browse?BROWSE.find(item=>item.key===browse)?.label:trimmed?'Matches':'Browse'}</Text>
          <Text testID="search-result-count" accessibilityLiveRegion="polite" className="font-dm text-fine text-taupe">{matches.length} {matches.length===1?'result':'results'}</Text>
        </View>
        {matches.length?matches.slice(0,limit).map(result=><IndexRow key={result.href} testID="search-result" title={result.title} subtitle={result.subtitle}
          glyph={entriesByHref.get(result.href)?.glyph||'pin'} onPress={()=>openResult(result)} />)
          :<EmptyState compact title={hydrating?'Checking the city…':'Nothing just yet'} message={hydrating?'Local listings are loading.':'Try a place, an artist, or a broader idea.'} actionLabel="Start again" onAction={reset} />}
        {matches.length>limit?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Show more search results" onPress={()=>setPage({key:pageKey,limit:limit+12})} style={{minHeight:48,justifyContent:'center'}}>
          <Text className="font-dm text-label text-peach">Show more</Text>
        </TouchableOpacity>:null}
      </View>:<View style={{marginTop:27}}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-fraunces text-section text-ink">Recent</Text>
          {recentHere.length?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear recent searches" onPress={()=>void clearHistory()} style={{minHeight:44,minWidth:44,justifyContent:'center',alignItems:'flex-end'}}>
            <Text className="font-dm text-fine text-peach">Clear</Text>
          </TouchableOpacity>:null}
        </View>
        {recentHere.length?recentHere.map(entry=><IndexRow key={entry.href} testID="search-recent" title={entry.label} glyph="clock" onPress={()=>openRecent(entry)} />)
          :<Text className="font-dm text-label text-taupe" style={{paddingVertical:12}}>Your searches will appear here.</Text>}
        <Text className="mb-2 mt-[25px] font-fraunces text-section text-ink">Browse</Text>
        <View className="flex-row flex-wrap" style={{columnGap:16}}>
          {BROWSE.map(item=><TouchableOpacity key={item.key} testID={`search-browse-${item.key}`} accessibilityRole="button" accessibilityLabel={item.label}
            activeOpacity={.7} onPress={()=>{setQuery('');setScope(item.scope);setBrowse(item.key);Keyboard.dismiss();}}
            style={{width:'45%',flexGrow:1,minHeight:53,flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:1,borderBottomColor:colors['edge-faint']}}>
            <Glyph name={item.glyph} size={14} color={colors['surface-accent']} /><Text numberOfLines={1} className="min-w-0 flex-1 font-dm text-label text-ink">{item.label}</Text><Glyph name="chevron" size={12} color={colors['fg-muted']} />
          </TouchableOpacity>)}
        </View>
      </View>}
    </View>
  </ScreenScroll></Screen>;
}
