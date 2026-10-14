import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EssentialEvent, EssentialNight, MenuSlip, MoreTable, StageHero } from '@/components/discover-cards';
import { Glyph } from '@/components/glyph';
import { RoomNote, RouteNote } from '@/components/field-notes';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { ListRow } from '@/components/list-row';
import { VeeMark } from '@/components/vee-mark';
import { ViatorPickCard } from '@/components/poster-card';
import { EmptyState } from '@/components/ui';
import { BUNDLE_CITY, useActiveCity, useActiveCityName } from '@/lib/city';
import { CRAWLS, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES, currentEventListings } from '@/lib/data';
import { useContentHydrating } from '@/lib/bootstrap';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend, useAllPlaces } from '@/lib/places';
import { buildSearchIndex, queryIndex } from '@/lib/search';
import { useElevation } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { hydrateViatorPicksFromBackend, sortedViatorPicks, useViatorPicks } from '@/lib/viator';

const MODES=[{value:'All',label:'For you',glyph:'spark'},{value:'Food',label:'Eat',glyph:'food'},
  {value:'Nightlife',label:'Bars',glyph:'drink'},{value:'Events',label:'Events',glyph:'ticket'},
  {value:'Routes',label:'Routes',glyph:'route'},{value:'Venues',label:'Venues',glyph:'pin'}] as const;
type Mode=(typeof MODES)[number]['value'];
function normalizeMode(raw?:string):Mode {return MODES.find(x=>x.value.toLowerCase()===String(raw).toLowerCase()||x.label.toLowerCase()===String(raw).toLowerCase())?.value||'All';}

function Heading({title,onAll}:{title:string;onAll?:()=>void}) {
  return <View className="flex-row items-center justify-between gap-x-2.5">
    <Text className="min-w-0 flex-1 font-fraunces text-ink" style={{fontSize:20,lineHeight:24,letterSpacing:-.4}}>{title}</Text>
    {onAll?<TouchableOpacity accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`} hitSlop={10} onPress={onAll}>
      <Text className="font-dm-medium text-fine text-peach">See all</Text></TouchableOpacity>:null}
  </View>;
}

function Shelf({title,children,onAll,fullWidth=false}:{title:string;children:ReactNode|((width:number)=>ReactNode);onAll?:()=>void;fullWidth?:boolean}) {
  const colors=useThemeColors(),ref=useRef<ScrollView>(null);
  const [width,setWidth]=useState(260),[offset,setOffset]=useState(0),[content,setContent]=useState(0);
  const step=fullWidth?width+12:161;
  return <View className="gap-y-2.5" testID={`shelf-${title.toLowerCase().replace(/\s+/g,'-')}`}>
    <View className="flex-row items-center gap-x-1"><View className="min-w-0 flex-1"><Heading title={title} /></View>
      {[-1,1].map(dir=><TouchableOpacity key={dir} accessibilityRole="button" accessibilityLabel={`Scroll ${title} ${dir<0?'backward':'forward'}`} hitSlop={{top:7,bottom:7}}
        disabled={dir<0?offset<1:offset+width>=content-1} onPress={()=>ref.current?.scrollTo({x:Math.max(0,offset+dir*step),animated:true})}
        style={{width:28,height:30,alignItems:'center',justifyContent:'center',opacity:(dir<0?offset<1:offset+width>=content-1)?.3:1}}>
        <View style={{transform:[{rotate:dir<0?'180deg':'0deg'}]}}><Glyph name="chevron" size={16} color={colors['fg-muted']} /></View>
      </TouchableOpacity>)}
    </View>
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onLayout={e=>setWidth(e.nativeEvent.layout.width)}
      onContentSizeChange={w=>setContent(w)} onScroll={e=>setOffset(e.nativeEvent.contentOffset.x)} scrollEventThrottle={16}
      contentContainerStyle={{gap:12,paddingVertical:2}} style={{width:'100%'}}>
      {typeof children==='function'?children(width):children}
    </ScrollView>
    {onAll?<TouchableOpacity accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`} onPress={onAll} hitSlop={8} className="self-start">
      <Text className="font-dm-medium text-fine text-peach">See all</Text></TouchableOpacity>:null}
  </View>;
}

export default function DiscoverScreen() {
  const router=useRouter(),params=useLocalSearchParams<{q?:string;mode?:string}>(),colors=useThemeColors(),lift=useElevation(1);
  const city=useActiveCity(),cityName=useActiveCityName(),local=city===BUNDLE_CITY;
  const [query,setQuery]=useState(params.q||''),[mode,setMode]=useState<Mode>(normalizeMode(params.mode));
  const [seed,setSeed]=useState(`${params.q||''}:${params.mode||''}`),[refreshing,setRefreshing]=useState(false);
  const nextSeed=`${params.q||''}:${params.mode||''}`;
  if(seed!==nextSeed){setSeed(nextSeed);setQuery(params.q||'');setMode(normalizeMode(params.mode));}
  const hydrating=useContentHydrating(),allPlaces=useAllPlaces(),allPicks=useViatorPicks(),tasteTags=useScoper(s=>s.tasteTags);
  const index=useMemo(()=>buildSearchIndex(allPlaces,allPicks),[allPlaces,allPicks]);
  const search=useMemo(()=>queryIndex(index,query,tasteTags),[index,query,tasteTags]);
  const shows=currentEventListings(),bars=local?[...NIGHTLIFE_SPOTS].sort((a,b)=>{
    const order=['bar-shiru','little-bird','crybaby','night-heron','penelope'];
    const rank=(id:string)=>order.includes(id)?order.indexOf(id):order.length;return rank(a.id)-rank(b.id);
  }):[];
  const restaurants=local?Object.values(RESTAURANTS):[];
  const order=['cookfarmer','mua','bardo','parche','farmhouse'];
  const tables=order.map(id=>restaurants.find(x=>x.id===id)).filter((x):x is NonNullable<typeof x>=>!!x);
  const remaining=restaurants.filter(x=>!order.includes(x.id));
  const extraOrder=['gogi','sinaloa','itani'];
  const more=[...remaining].sort((a,b)=>{
    const rank=(id:string)=>extraOrder.includes(id)?extraOrder.indexOf(id):extraOrder.length;return rank(a.id)-rank(b.id);
  }).slice(0,3);
  const routes=local?Object.values(CRAWLS):[],venues=local?Object.values(VENUES):[];
  const onRefresh=async()=>{setRefreshing(true);try{await Promise.all([hydrateEventsFromBackend(true),hydratePlacesFromBackend(true),hydrateViatorPicksFromBackend(true)]);}finally{setRefreshing(false);}};
  const choose=(value:Mode)=>setMode(value);
  const stage=shows.length?<View className="gap-y-4">
    <Heading title="On stage" /><StageHero event={shows[0]} onPress={()=>router.push(`/event/${shows[0].id}`)} />
    {shows.length>1?<Shelf title="More on stage" onAll={mode==='All'?()=>choose('Events'):undefined}>
      {shows.slice(1,mode==='All'?4:undefined).map(x=><EssentialEvent key={x.id} event={x} onPress={()=>router.push(`/event/${x.id}`)} />)}
    </Shelf>:null}
  </View>:<EmptyState compact title={hydrating?'Loading the stage…':'No current shows yet'} message={hydrating?'Checking the live calendar.':'Current listings appear here as the calendar updates.'} />;
  const food=tables.length?<View className="gap-y-5 border-t border-edge-soft pt-4">
    <Shelf title="Find a good table" fullWidth>{width=>tables.map(x=><MenuSlip key={x.id} restaurant={x} width={width} onPress={()=>router.push(`/restaurant/${x.id}`)} />)}</Shelf>
    {more.length?<View className="gap-y-2.5"><Heading title="More good tables" onAll={()=>router.push('/featured')} />
      <View className="gap-y-2.5">{more.map(x=><MoreTable key={x.id} restaurant={x} onPress={()=>router.push(`/restaurant/${x.id}`)} />)}</View></View>:null}
  </View>:null;
  const nightlife=bars.length?<View className="border-t border-edge-soft pt-4"><Shelf title="After dinner" onAll={mode==='All'?()=>choose('Nightlife'):undefined}>
    {bars.slice(0,mode==='All'?5:undefined).map(x=><EssentialNight key={x.id} spot={x} onPress={()=>router.push(`/night/${x.id}`)} />)}
  </Shelf></View>:null;
  const wander=routes.length?<View className="gap-y-2 border-t border-edge-soft pt-4"><Heading title="A little wandering" onAll={mode==='All'?()=>choose('Routes'):undefined} />
    <View>{routes.slice(0,mode==='All'?2:undefined).map((x,i)=><RouteNote key={x.id} route={x} index={i} divider={i>0} onPress={()=>router.push(`/crawl/${x.id}`)} />)}</View>
  </View>:null;
  const rooms=venues.length?<View className="gap-y-2 border-t border-edge-soft pt-4"><Heading title="Rooms worth knowing" onAll={mode==='All'?()=>choose('Venues'):undefined} />
    <View>{venues.slice(0,mode==='All'?2:undefined).map((x,i)=><RoomNote key={x.id} venue={x} divider={i>0} onPress={()=>router.push(`/venue/${x.id}`)} />)}</View>
  </View>:null;
  return <Screen><ScreenScroll gap={19} clearsTabBar refreshing={refreshing} onRefresh={onRefresh} keyboardShouldPersistTaps="handled">
    <Text className="mt-2 font-fraunces text-display text-ink">Discover</Text>
    <View className="flex-row items-center gap-x-2.5 rounded-full bg-surface-raised px-3.5 py-2">
      <Glyph name="search" size={17} color={colors['fg-muted']} /><TextInput accessibilityLabel="Search Discover" value={query} onChangeText={setQuery}
        placeholder="A place, artist, or kind of evening" placeholderTextColor={colors['fg-muted']} className="min-w-0 flex-1 py-2 font-dm text-body text-ink" />
      {query?<TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={()=>setQuery('')}><Glyph name="close" size={15} color={colors['fg-muted']} /></TouchableOpacity>:null}
    </View>
    <HRow gap={11.44} bleed={false}>{MODES.map(x=><TouchableOpacity key={x.value} accessibilityRole="button" accessibilityLabel={x.label}
      accessibilityState={{selected:mode===x.value}} activeOpacity={.78} hitSlop={{top:6,bottom:6}} onPress={()=>choose(x.value)}
      style={[lift,{minHeight:32.2,paddingVertical:6.44,paddingHorizontal:8.28,borderRadius:999,flexDirection:'row',alignItems:'center',gap:4.6,
        backgroundColor:mode===x.value?colors['selected-surface']:colors['surface-raised']}]}>
      {x.value==='All'?<VeeMark size={16} color={mode===x.value?colors['selected-glyph']:colors['vee-strong']} />:<Glyph name={x.glyph} size={13.8} color={mode===x.value?colors['selected-glyph']:colors['vee-strong']} />}
      <Text className="font-dm" style={{fontSize:11.04,lineHeight:15,color:mode===x.value?colors['on-selected']:colors.fg}}>{x.label}</Text>
    </TouchableOpacity>)}</HRow>
    {query.trim()?<View className="gap-y-2"><Heading title={`Matches for “${query}”`} />
      {search.length?search.slice(0,40).map((x,i)=><ListRow key={`${x.kind}/${x.id}`} title={x.title} meta={x.subtitle} image={x.image} divider={i<Math.min(search.length,40)-1} onPress={()=>router.push(x.href as never)} />)
        :<EmptyState title="Nothing here just yet" message="Try another place, artist or kind of evening." actionLabel="Clear search" onAction={()=>setQuery('')} />}
    </View>:<>
      <Text className="font-dm text-label text-taupe">A show to catch, a table nearby, somewhere to linger.</Text>
      {(mode==='All'||mode==='Events')?stage:null}
      {(mode==='All'||mode==='Food')?food:null}
      {(mode==='All'||mode==='Nightlife')?nightlife:null}
      {(mode==='All'||mode==='Routes')?wander:null}
      {(mode==='All'||mode==='Venues')?rooms:null}
      {!local&&mode!=='Events'&&mode!=='All'?<EmptyState title={`More of ${cityName} is on the way`} message="Browse the live local listings while curated sections are being added." />:null}
      {mode==='Routes'&&allPicks.length?<Shelf title="Picks for your stay" onAll={()=>router.push('/picks')}>
        {sortedViatorPicks(allPicks).slice(0,12).map(x=><ViatorPickCard key={x.id} pick={x} onPress={()=>router.push(`/pick/${x.id}`)} />)}
      </Shelf>:null}
    </>}
  </ScreenScroll></Screen>;
}
