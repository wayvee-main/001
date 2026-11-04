import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CitySearchBar } from '@/components/city-controls';
import { HomeDoorCard } from '@/components/home-field-guide';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksBanners, LocalPerksCard, LocalPerksHeader, PerksHeading, PerksRail, PerksVeeRibbon } from '@/components/local-perks';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { homeIdeaPhoto } from '@/lib/home-guide';
import { homeCollectionPhotos, homeIdeaPhotos } from '@/lib/home-index-photos';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { perksEntries } from '@/lib/local-perks';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { useHomeGuide } from '@/lib/use-home-guide';
import { hydrateWeatherFromBackend } from '@/lib/weather';

export default function HomeScreen() {
  const router = useRouter(), { catalog, now, displayCity, refreshRegional } = useHomeGuide();
  const refreshLocation = useScoper(s => s.refreshLocation), [refreshing, setRefreshing] = useState(false);
  const ideas = homeDiscoveryIdeas(now), nearestTables = perksEntries(catalog, 'eat'), bars = perksEntries(catalog, 'bars');
  const featured = ['place:osm:2306696660','restaurant:itani','restaurant:mua'].flatMap(key => catalog.entries[key] ? [catalog.entries[key]] : []);
  const tables = [...featured, ...nearestTables.filter(entry => !featured.some(item => item.kind === entry.kind && item.id === entry.id))];
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), refreshLocation(), refreshRegional()]); }
    finally { setRefreshing(false); }
  };
  return <Screen><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader />
    <View style={{ gap: 11 }}>
      <View>
        <CitySearchBar testID="home-search" labelTestID="home-search-label" city={displayCity} onPress={() => router.push('/search')} />
        <HomeTimelyRecommendations catalog={catalog} now={now} />
      </View>
      <LocalCategoryShelf catalog={catalog} />
    </View>
    <LocalPerksBanners catalog={catalog} />
    {tables.length ? <View><PerksHeading title="A few good tables" action="See all" onPress={() => router.push(HOME_LEDGERS.eat.href)} />
      <PerksRail entries={tables.slice(0, 6)} catalog={catalog} />
    </View> : null}
    <PerksVeeRibbon />
    {bars.length ? <View><PerksHeading title="After dinner" action="Explore" onPress={() => router.push(HOME_LEDGERS.bars.href)} />
      <View style={{ gap: 10 }}>{bars.slice(0, 3).map(entry => <LocalPerksCard key={entry.kind + ':' + entry.id} entry={entry} catalog={catalog} />)}</View>
    </View> : null}
    <View><PerksHeading title="For you" action="See all" onPress={() => router.push('/home/ideas')} />
      <View style={{ gap: 10 }}>{ideas.map(idea => <HomeDoorCard key={idea.id} testID={`home-idea-${idea.id}`} title={idea.title} meta={idea.detail}
        image={homeIdeaPhoto(idea, catalog)} photos={homeIdeaPhotos(idea, catalog)} glyph={idea.glyph} onPress={() => router.push(idea.href as never)} />)}</View>
    </View>
    {catalog.collections.length ? <View><PerksHeading title="Collections" action="See all" onPress={() => router.push('/home/collections')} />
      <HRow gap={10}>{catalog.collections.map(collection => <HomeDoorCard key={collection.id} testID={`home-collection-${collection.id}`} width={252}
        title={collection.title} meta={`${collection.items.length} picks · ${collection.subtitle.split(' · ').slice(-1)[0]}`} image={collection.coverImage} photos={homeCollectionPhotos(collection.id, catalog)} glyph={homeCollectionGlyph(collection.id)}
        onPress={() => router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />)}</HRow>
    </View> : null}
  </ScreenScroll></Screen>;
}
