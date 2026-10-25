import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { HomeEveningRibbon, HomeHeader } from '@/components/home-top';
import { AroundYou, type CountTile } from '@/components/home-tiles';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { Glyph } from '@/components/glyph';
import { CityChip, CitySearchBar } from '@/components/city-controls';
import { HomeDoorCard } from '@/components/home-field-guide';
import { SectionHeading } from '@/components/section-heading';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { homeGuideHrefFromLegacy, homeIdeaPhoto } from '@/lib/home-guide';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { activeReminders } from '@/lib/reminders';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';
import { useHomeQuickActions } from '@/lib/use-home-quick-actions';
import { useControlSurface } from '@/lib/shadows';
import { hydrateWeatherFromBackend } from '@/lib/weather';

export default function HomeScreen() {
  const router = useRouter(), colors = useThemeColors(), s = useScoper();
  const {catalog,now,nearest,displayCity:city,refreshRegional} = useHomeGuide();
  const control = useControlSurface();
  const quickActions = useHomeQuickActions(now);
  const [refreshing, setRefreshing] = useState(false);
  const collections = catalog.collections;
  const ideas = homeDiscoveryIdeas(now);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), s.refreshLocation(),refreshRegional()]); }
    finally { setRefreshing(false); }
  };
  const nightlife = catalog.categories.bars;
  const crawls = catalog.categories.routes;
  const events = catalog.categories.events;
  const tiles: CountTile[] = [
    { key:'eat', count:String(nearest.length), glyph:'food', label:'Eat', hint:'Nearby places', tint:'tile-eat', ink:'fg', onPress:()=>router.push(HOME_LEDGERS.eat.href) },
    { key:'bars', count:String(nightlife.length), glyph:'drink', label:'Bars', hint:'After dinner', tint:'tile-bars', ink:'fg', onPress:()=>router.push(HOME_LEDGERS.bars.href) },
    { key:'routes', count:String(crawls.length), glyph:'route', label:'Routes', hint:'A few good stops', tint:'tile-routes', ink:'fg', onPress:()=>router.push(HOME_LEDGERS.routes.href) },
    { key:'events', count:String(events.length), glyph:'ticket', label:'Events', hint:'Find your next show', tint:'tile-events', ink:'fg', onPress:()=>router.push(HOME_LEDGERS.events.href) },
  ];
  return <Screen><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <HomeHeader hasReminders={activeReminders(s.plans,s.stay).length>0}
      onNotifications={()=>router.push('/notifications')} onProfile={()=>router.push('/profile')} />
    <Text className="font-fraunces text-ink" style={{fontSize:25,lineHeight:29,letterSpacing:-.8}}>Shall we wander?</Text>
    <CitySearchBar testID="home-search" labelTestID="home-search-label" city={city} onPress={()=>router.push('/search')} />
    <View testID="home-quick-actions" className="flex-row items-center gap-x-2">
      <TouchableOpacity testID="home-stay-chip" accessibilityRole="button" accessibilityLabel={s.stay?'Update your stay':'Link your stay'} activeOpacity={.74} onPress={()=>s.openStaySheet()} style={[control,{backgroundColor:colors['surface-ribbon']}]}
        className="min-h-[34px] shrink-0 flex-row items-center gap-x-1.5 rounded-full px-2.5 py-[7px]" hitSlop={{top:6,bottom:6}}>
        <Glyph name="briefcase" size={13} color={colors['fg-muted']} />
        <Text className="font-dm text-fine text-ink">{s.stay?'Update your stay':'Link your stay'}</Text>
      </TouchableOpacity>
      {quickActions.length?<>
        <View testID="home-quick-action-divider" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{width:1,height:20,backgroundColor:colors.edge}} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="min-w-0 flex-1"
          contentContainerStyle={{gap:6,paddingVertical:3,paddingRight:2}}>
          {quickActions.map(action=><CityChip key={action.id} testID={`home-quick-chip-${action.id}`} label={action.name} glyph={action.glyph} maxWidth={190}
            accessibilityLabel={`${action.intent}: ${action.name}`} onPress={()=>router.push(homeGuideHrefFromLegacy(action.href) as never)} />)}
        </ScrollView>
      </>:null}
    </View>
    <HomeEveningRibbon onPress={()=>router.push('/create')} />
    <View className="gap-y-3 border-t border-edge-faint pt-4">
      <SectionHeading title="Around you" /><AroundYou tiles={tiles} />
    </View>
    <View className="gap-y-3 border-t border-edge-faint pt-4">
      <SectionHeading title="For you" action="See all" onPress={()=>router.push('/home/ideas')} />
      <View testID="home-ideas-preview" className="gap-y-2">
        {ideas.map(idea=><HomeDoorCard key={idea.id} testID={`home-idea-${idea.id}`} title={idea.title} meta={idea.detail} image={homeIdeaPhoto(idea,catalog)} glyph={idea.glyph} onPress={()=>router.push(idea.href as never)} />)}
      </View>
      {collections.length?<><SectionHeading title="Collections" action="See all" onPress={()=>router.push('/home/collections')} />
        <HRow gap={10}>{collections.map(collection=><HomeDoorCard key={collection.id} testID={`home-collection-${collection.id}`} width={252}
          title={collection.title} meta={`${collection.items.length} picks · ${collection.subtitle.split(' · ').slice(-1)[0]}`} image={collection.coverImage} glyph={homeCollectionGlyph(collection.id)}
          onPress={()=>router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />)}</HRow></>:null}
    </View>
  </ScreenScroll></Screen>;
}
