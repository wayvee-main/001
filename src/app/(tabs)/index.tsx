import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { HomeEveningRibbon, HomeHeader } from '@/components/home-top';
import { AroundYou, RailCard, type CountTile } from '@/components/home-tiles';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { SectionHeading } from '@/components/section-heading';
import { BUNDLE_CITY, useActiveCity, useActiveCityName } from '@/lib/city';
import { useNow } from '@/lib/clock';
import { CRAWLS, CURATED_COLLECTION_ORDER, CURATED_COLLECTIONS, NIGHTLIFE_SPOTS, RESTAURANTS, activeCollectionItems, currentEventListings } from '@/lib/data';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { activeReminders } from '@/lib/reminders';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useNearestPool } from '@/lib/use-nearest-pool';
import { useHomeQuickActions } from '@/lib/use-home-quick-actions';
import { HOME_TILE_PREVIEW_PHOTOS } from '@/lib/home-tile-photos';
import { buildHomeTilePreviews } from '@/lib/home-tile-previews';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { hydrateWeatherFromBackend } from '@/lib/weather';

export default function HomeScreen() {
  const router = useRouter(), colors = useThemeColors(), s = useScoper();
  const city = useActiveCityName(), citySlug = useActiveCity(), nearest = useNearestPool();
  const surface = useRaisedSurface(1), control = useControlSurface();
  const {colorScheme}=useColorScheme(),light=colorScheme==='light';
  const now = useNow();
  const quickActions = useHomeQuickActions(now);
  const searchLabel = `Search the city of ${/^san francisco$/i.test(city) ? 'SF' : city}`;
  const [refreshing, setRefreshing] = useState(false);
  const collections = useMemo(() => citySlug===BUNDLE_CITY
    ? CURATED_COLLECTION_ORDER.map(id => CURATED_COLLECTIONS[id]).filter(x => activeCollectionItems(x,now).length) : [], [now,citySlug]);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), s.refreshLocation()]); }
    finally { setRefreshing(false); }
  };
  const local = citySlug === BUNDLE_CITY;
  const nightlife = local ? NIGHTLIFE_SPOTS : [];
  const crawls = local ? Object.values(CRAWLS) : [];
  const events = currentEventListings(now);
  const previews = buildHomeTilePreviews({
    nearest, featuredRestaurant: local ? RESTAURANTS.mua : undefined,
    nightlife, crawls, events, now,
  });
  const tileDefinitions: CountTile[] = [
    { ...previews.eat, key:'eat', count:String(nearest.length), glyph:'food', label:'Eat', tint:'tile-eat', ink:'fg', onPress:()=>router.push('/featured') },
    { ...previews.bars, key:'bars', count:String(nightlife.length), glyph:'drink', label:'Bars', tint:'tile-bars', ink:'fg', onPress:()=>router.push('/discover?mode=Nightlife') },
    { ...previews.routes, key:'routes', count:String(crawls.length), glyph:'route', label:'Routes', tint:'tile-routes', ink:'fg', onPress:()=>router.push('/discover?mode=Routes') },
    { ...previews.events, key:'events', count:String(events.length), glyph:'ticket', label:'Events', tint:'tile-events', ink:'fg', onPress:()=>router.push('/discover?mode=Events') },
  ];
  const tiles = tileDefinitions.map(tile => {
    const photo = tile.photoKey ? HOME_TILE_PREVIEW_PHOTOS[tile.photoKey] : undefined;
    return { ...tile, image: photo?.source ?? tile.image, imageLabel: photo?.label ?? tile.imageLabel };
  });
  return <Screen><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <HomeHeader hasReminders={activeReminders(s.plans,s.stay).length>0}
      onNotifications={()=>router.push('/notifications')} onProfile={()=>router.push('/profile')} />
    <Text className="font-fraunces text-ink" style={{fontSize:25,lineHeight:29,letterSpacing:-.8}}>Shall we wander?</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Search the city of ${city}`} onPress={()=>s.openSheet('search')}
      style={[control,{minHeight:52,backgroundColor:colors['surface-search']}]}
      className="flex-row items-center gap-x-2.5 rounded-full bg-surface-search pl-3.5 pr-[7px] py-[7px] border border-edge-faint shadow-soft-light dark:shadow-soft-dark">
      <Glyph name="search" size={17} color={colors['fg-muted']} />
      <Text testID="home-search-label" numberOfLines={1} className="min-w-0 flex-1 font-dm text-label text-taupe">{searchLabel}</Text>
      <View className="h-[37px] w-[37px] items-center justify-center rounded-full bg-accent-fill border border-edge-faint shadow-soft-light dark:shadow-soft-dark">
        <Glyph name="arrow" size={17} color={colors['on-accent']} />
      </View>
    </TouchableOpacity>
    <View testID="home-quick-actions" className="flex-row items-center gap-x-2">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={s.stay?'Update your stay':'Link your stay'} activeOpacity={.74} onPress={()=>s.openStaySheet()} style={control}
        className="min-h-[34px] shrink-0 flex-row items-center gap-x-1.5 rounded-full px-2.5 py-[7px]" hitSlop={{top:6,bottom:6}}>
        <Glyph name="briefcase" size={13} color={colors['fg-muted']} />
        <Text className="font-dm text-fine text-ink">{s.stay?'Update your stay':'Link your stay'}</Text>
      </TouchableOpacity>
      {quickActions.length?<>
        <View testID="home-quick-action-divider" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{width:1,height:20,backgroundColor:colors.edge}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="min-w-0 flex-1"
          contentContainerStyle={{gap:6,paddingVertical:3,paddingRight:2}}>
          {quickActions.map((action)=><TouchableOpacity key={action.id} accessibilityRole="button"
            accessibilityLabel={`${action.intent}: ${action.name}`} activeOpacity={.72} onPress={()=>router.push(action.href)}
            style={[control,{backgroundColor:light?colors['surface-search']:colors['surface-raised'],maxWidth:190}]}
            className="min-h-[34px] flex-row items-center gap-x-1.5 rounded-full px-2.5 py-[7px] border border-edge-faint shadow-soft-light dark:shadow-soft-dark" hitSlop={{top:6,bottom:6}}>
            <Glyph name={action.glyph} size={13} color={colors['fg-muted']} />
            <Text numberOfLines={1} className="min-w-0 shrink font-dm text-fine text-ink">{action.name}</Text>
          </TouchableOpacity>)}
        </ScrollView>
      </>:null}
    </View>
    <HomeEveningRibbon onPress={()=>router.push('/create')} />
    <View className="gap-y-3 border-t border-edge-faint pt-4">
      <SectionHeading title="Around you" /><AroundYou tiles={tiles} />
    </View>
    <View className="gap-y-3 border-t border-edge-faint pt-4">
      <SectionHeading title="For you" />
      <View className="flex-row items-center justify-between"><Text className="font-dm-medium text-body text-ink">Nearest</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="See all nearest places" onPress={()=>router.push('/nearest')} hitSlop={10}>
          <Text className="font-dm-medium text-fine text-peach">See all</Text></TouchableOpacity></View>
      <View testID="nearest-preview" className="gap-y-2">
        {nearest.slice(0,3).map(x=><TouchableOpacity key={x.href} accessibilityRole="button" accessibilityLabel={`View ${x.name}`} onPress={()=>router.push(x.href)}
          style={[surface,{minHeight:83}]}
          className="flex-row items-center gap-x-3 rounded-setting bg-surface-raised px-[11px] py-[11px] border border-edge-faint shadow-soft-light dark:shadow-soft-dark">
          <Photo uri={x.image} fallbackGlyph={x.thumbnailGlyph} fallbackLabel={`Photo unavailable for ${x.name}`} radius={11} style={{width:58,height:58}} />
          <View className="min-w-0 flex-1"><Text numberOfLines={2} className="font-dm-medium text-card-name text-ink">{x.name}</Text>
            <Text className="mt-1 font-dm text-fine text-taupe">{[x.cuisine,x.price,x.distanceLabel].filter(Boolean).join(' · ')}</Text></View>
          <Glyph name="chevron" size={14} color={colors['surface-accent']} />
        </TouchableOpacity>)}
        {!nearest.length?<Text className="font-dm text-label text-taupe">Nearby places appear as the local catalog loads.</Text>:null}
      </View>
      {collections.length?<><SectionHeading title="Collections" action="See all" onPress={()=>router.push('/collection')} />
        <HRow gap={10}>{collections.map(x=><RailCard key={x.id} image={x.coverImage} title={x.title} meta={x.subtitle} onPress={()=>router.push(`/collection/${x.id}`)} />)}</HRow></>:null}
    </View>
  </ScreenScroll></Screen>;
}
