import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Glyph } from '@/components/glyph';
import { CityChip, CitySearchBar } from '@/components/city-controls';
import { BarNote, TrailLead, RoomNote, RouteNote, ShowNote, TableNote, PHOTO_NOTE } from '@/components/field-notes';
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
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useNow } from '@/lib/clock';
import { hydrateViatorPicksFromBackend, sortedViatorPicks, useViatorPicks } from '@/lib/viator';

const MODES=[{value:'All',label:'For you',glyph:'spark'},{value:'Food',label:'Eat',glyph:'food'},
  {value:'Nightlife',label:'Bars',glyph:'drink'},{value:'Events',label:'Events',glyph:'ticket'},
  {value:'Routes',label:'Routes',glyph:'route'},{value:'Venues',label:'Venues',glyph:'pin'}] as const;
type Mode=(typeof MODES)[number]['value'];
function normalizeMode(raw?:string):Mode {return MODES.find(x=>x.value.toLowerCase()===String(raw).toLowerCase()||x.label.toLowerCase()===String(raw).toLowerCase())?.value||'All';}

function Heading({title,onAll,trail=false}:{title:string;onAll?:()=>void;trail?:boolean}) {
  const colors=useThemeColors();
  return <View className="flex-row items-center justify-between gap-x-2.5">
    {trail?<View pointerEvents="none" style={{position:'absolute',left:-26,top:3,width:18,height:18,borderRadius:9,alignItems:'center',justifyContent:'center'}}>
      <View testID="trail-section-dot" style={{width:8,height:8,borderRadius:4,backgroundColor:colors['fg-accent']}} />
    </View>:null}
    <Text className="min-w-0 flex-1 font-fraunces text-ink" style={{fontSize:trail?20:21,lineHeight:trail?24:25.2,letterSpacing:-.35}}>{title}</Text>
    {onAll?<TouchableOpacity accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`} hitSlop={10} onPress={onAll}>
      <View className="flex-row items-center gap-x-1"><Text className="font-dm text-fine text-peach">See all</Text><Glyph name="arrow" size={12} color={colors['fg-accent']} /></View></TouchableOpacity>:null}
  </View>;
}

function TrailSection({title,children,onAll}:{title:string;children:ReactNode;onAll?:()=>void}) {
  return <View className="mt-[27px]" testID={`trail-section-${title.toLowerCase().replace(/\s+/g,'-')}`}>
    <Heading title={title} onAll={onAll} trail /><View className="mt-2">{children}</View>
  </View>;
}

/** Two complete cards meet the hero's edges on phones; extra items swipe into
 * view. Keep wide-screen card dimensions and leave the final edge unfaded. */
function PhotoRow({children,count}:{children:(cardWidth:number)=>ReactNode;count:number}) {
  const {width:screenWidth}=useWindowDimensions();
  const [width,setWidth]=useState(0);
  const gap=16,columns=Math.min(count,2);
  const cardWidth=screenWidth<=600&&width>0&&columns>0
    ? (width-gap*(columns-1))/columns : PHOTO_NOTE.width;
  return <ScrollView testID="discover-photo-row" horizontal showsHorizontalScrollIndicator={false}
    onLayout={e=>setWidth(e.nativeEvent.layout.width)}
    style={{marginVertical:-6}} contentContainerStyle={{gap,paddingVertical:6}}
    snapToInterval={cardWidth+gap} decelerationRate="fast" disableIntervalMomentum>
    {children(cardWidth)}
  </ScrollView>;
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
      <View className="flex-row items-center gap-x-1"><Text className="font-dm text-fine text-peach">See all</Text><Glyph name="arrow" size={12} color={colors['fg-accent']} /></View></TouchableOpacity>:null}
  </View>;
}

export default function DiscoverScreen() {
  const router=useRouter(),params=useLocalSearchParams<{q?:string;mode?:string}>(),colors=useThemeColors();
  const city=useActiveCity(),cityName=useActiveCityName(),local=city===BUNDLE_CITY;
  const [query,setQuery]=useState(params.q||''),[mode,setMode]=useState<Mode>(normalizeMode(params.mode));
  const [seed,setSeed]=useState(`${params.q||''}:${params.mode||''}`),[refreshing,setRefreshing]=useState(false);
  const nextSeed=`${params.q||''}:${params.mode||''}`;
  if(seed!==nextSeed){setSeed(nextSeed);setQuery(params.q||'');setMode(normalizeMode(params.mode));}
  const hydrating=useContentHydrating(),allPlaces=useAllPlaces(),allPicks=useViatorPicks(),tasteTags=useScoper(s=>s.tasteTags);
  const index=useMemo(()=>buildSearchIndex(allPlaces,allPicks),[allPlaces,allPicks]);
  const search=useMemo(()=>queryIndex(index,query,tasteTags),[index,query,tasteTags]);
  const now=useNow();
  const shows=currentEventListings(now),bars=local?[...NIGHTLIFE_SPOTS].sort((a,b)=>{
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
  const supportingShows=shows.slice(1,mode==='All'?3:undefined);
  const afterDinner=bars.slice(0,mode==='All'?3:undefined);
  const roomPicks=venues.slice(0,mode==='All'?3:undefined);
  const stage=shows.length?<>
    <TrailSection title="On stage"><TrailLead event={shows[0]} onPress={()=>router.push(`/event/${shows[0].id}`)} /></TrailSection>
    {shows.length>1?<TrailSection title="More on stage" onAll={mode==='All'?()=>choose('Events'):undefined}>
      <PhotoRow count={supportingShows.length}>{cardWidth=>supportingShows.map(x=><ShowNote key={x.id} event={x} cardWidth={cardWidth} onPress={()=>router.push(`/event/${x.id}`)} />)}</PhotoRow>
    </TrailSection>:null}
  </>:<TrailSection title="On stage"><EmptyState compact title={hydrating?'Loading the stage…':'No current shows yet'} message={hydrating?'Checking the live calendar.':'Current listings appear here as the calendar updates.'} /></TrailSection>;
  const food=tables.length?<>
    <TrailSection title="Find a good table">
    <View className="gap-y-2">{tables.slice(0,mode==='All'?3:undefined).map((x,i)=><TableNote key={x.id} restaurant={x} divider={i>0} onPress={()=>router.push(`/restaurant/${x.id}`)} />)}</View>
    </TrailSection>
    {more.length?<TrailSection title="More good tables" onAll={()=>router.push('/featured')}>
      <PhotoRow count={more.length}>{cardWidth=>more.map(x=><TableNote key={x.id} restaurant={x} strip cardWidth={cardWidth} divider={false} onPress={()=>router.push(`/restaurant/${x.id}`)} />)}</PhotoRow>
    </TrailSection>:null}
  </>:null;
  const nightlife=bars.length?<TrailSection title="After dinner" onAll={mode==='All'?()=>choose('Nightlife'):undefined}>
    <PhotoRow count={afterDinner.length}>{cardWidth=>afterDinner.map(x=><BarNote key={x.id} spot={x} cardWidth={cardWidth} onPress={()=>router.push(`/night/${x.id}`)} />)}</PhotoRow>
  </TrailSection>:null;
  const wander=routes.length?<TrailSection title="A little wandering" onAll={mode==='All'?()=>choose('Routes'):undefined}>
    <View className="gap-y-2">{routes.slice(0,mode==='All'?2:undefined).map((x,i)=><RouteNote key={x.id} route={x} index={i} divider={i>0} onPress={()=>router.push(`/crawl/${x.id}`)} />)}</View>
  </TrailSection>:null;
  const rooms=venues.length?<TrailSection title="Rooms worth knowing" onAll={mode==='All'?()=>choose('Venues'):undefined}>
    <PhotoRow count={roomPicks.length}>{cardWidth=>roomPicks.map(x=><RoomNote key={x.id} venue={x} cardWidth={cardWidth} onPress={()=>router.push(`/venue/${x.id}`)} />)}</PhotoRow>
  </TrailSection>:null;
  return <Screen><ScreenScroll gap={0} clearsTabBar refreshing={refreshing} onRefresh={onRefresh} keyboardShouldPersistTaps="handled">
    <View testID="discover-header" style={{paddingTop:10,marginBottom:18}}>
      <Text testID="discover-title" className="font-fraunces text-ink" style={{fontSize:26,lineHeight:29.12,letterSpacing:-.468}}>Discover</Text>
      <Text testID="discover-city" className="mt-0.5 font-dm text-meta text-taupe">{cityName}</Text>
    </View>
    <CitySearchBar testID="discover-search" city={cityName} inputLabel="Search Discover" value={query} onPress={()=>router.push({pathname:'/search',params:query?{q:query}:{}})} />
    <View className="mt-2.5 mb-[8px]"><HRow gap={6} bleed={false}>{MODES.map(x=><CityChip key={x.value} testID={`discover-chip-${x.value.toLowerCase()}`}
      label={x.label} glyph={x.value==='All'?undefined:x.glyph} selected={mode===x.value} onPress={()=>choose(x.value)}
      icon={x.value==='All'?<VeeMark size={13} color={mode===x.value?colors['selected-glyph']:colors['fg-muted']} />:undefined} />)}</HRow></View>
    {query.trim()?<View className="gap-y-2"><Heading title={`Matches for “${query}”`} />
      {search.length?search.slice(0,40).map((x,i)=><ListRow key={`${x.kind}/${x.id}`} title={x.title} meta={x.subtitle} image={x.image} divider={i<Math.min(search.length,40)-1} onPress={()=>router.push(x.href as never)} />)
        :<EmptyState title="Nothing here just yet" message="Try another place, artist or kind of evening." actionLabel="Clear search" onAction={()=>setQuery('')} />}
    </View>:<>
      {/* The strapline that sat here carried a 24px gap above the trail. With
        * it gone the first stop rides just under the mode chips. */}
      <View testID="evening-trail" style={{paddingLeft:20,position:'relative'}}>
      <View testID="evening-trail-thread" pointerEvents="none" style={{position:'absolute',left:3,top:16,bottom:20,width:1,backgroundColor:colors['edge-faint']}} />
      {(mode==='All'||mode==='Events')?stage:null}
      {(mode==='All'||mode==='Food')?food:null}
      {(mode==='All'||mode==='Nightlife')?nightlife:null}
      {(mode==='All'||mode==='Routes')?wander:null}
      {(mode==='All'||mode==='Venues')?rooms:null}
      {!local&&mode!=='Events'&&mode!=='All'?<EmptyState title={`More of ${cityName} is on the way`} message="Browse the live local listings while curated sections are being added." />:null}
      {mode==='Routes'&&allPicks.length?<Shelf title="Picks for your stay" onAll={()=>router.push('/picks')}>
        {sortedViatorPicks(allPicks).slice(0,12).map(x=><ViatorPickCard key={x.id} pick={x} onPress={()=>router.push(`/pick/${x.id}`)} />)}
      </Shelf>:null}
      </View>
    </>}
  </ScreenScroll></Screen>;
}
