import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CitySearchBar } from '@/components/city-controls';
import { AuroraEntryRow, AuroraList, SectionRule } from '@/components/aurora';
import { DaybreakFeature, DaybreakIntro, DaybreakPeriodPicker, type DaybreakPeriod } from '@/components/daybreak';
import { HomeDoorCard } from '@/components/home-field-guide';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksBanners, LocalPerksHeader, PerksHeading, PerksVeeRibbon } from '@/components/local-perks';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { homeIdeaPhoto } from '@/lib/home-guide';
import { homeCollectionPhotos, homeIdeaPhotos, homeIndexPhotos } from '@/lib/home-index-photos';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { eventsLeadNow } from '@/lib/daypart';
import { perksEntries, perksFeaturedEntries } from '@/lib/local-perks';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { useHomeGuide } from '@/lib/use-home-guide';
import { hydrateWeatherFromBackend } from '@/lib/weather';

export default function HomeScreen() {
  const router = useRouter(), { catalog, now, displayCity, refreshRegional } = useHomeGuide();
  const refreshLocation = useScoper(s => s.refreshLocation), [refreshing, setRefreshing] = useState(false);
  const [periodOverride, setPeriodOverride] = useState<DaybreakPeriod | null>(null);
  const period = periodOverride || (eventsLeadNow(now) ? 'evening' : 'day');
  const ideas = homeDiscoveryIdeas(now), tables = perksFeaturedEntries(catalog, 'eat'), bars = perksEntries(catalog, 'bars'), events = perksEntries(catalog, 'events');
  const table = tables.find(entry => homeIndexPhotos(entry, catalog).length && (entry.detailContent?.menu?.items.length || entry.detailContent?.menuDocuments?.length)) || tables.find(entry => homeIndexPhotos(entry, catalog).length) || tables[0];
  const feature = period === 'evening' ? events.find(entry => entry.image) || table || bars[0] : table || perksEntries(catalog, 'routes')[0];
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), refreshLocation(), refreshRegional()]); }
    finally { setRefreshing(false); }
  };
  const vee = <PerksVeeRibbon />;
  return <Screen aurora><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader location={false} />
    <DaybreakIntro city={displayCity} />
    <View style={{ gap: 6, marginBottom: -6 }}>
      <CitySearchBar variant="aurora" testID="home-search" labelTestID="home-search-label" city={displayCity} onPress={() => router.push('/search')} />
      <HomeTimelyRecommendations catalog={catalog} now={now} />
    </View>
    <LocalCategoryShelf catalog={catalog} />
    <DaybreakPeriodPicker value={period} onChange={setPeriodOverride} />
    <View style={{ marginTop: 10, gap: 12 }}>
      {feature ? <View><PerksHeading title={period === 'evening' ? 'A good way into the evening' : 'A very good place to start'} />
        <DaybreakFeature entry={feature} catalog={catalog} now={now} />
      </View> : null}
      <LocalPerksBanners catalog={catalog} />
    </View>
    <SectionRule />
    {bars.length ? <View style={{ gap: 12 }}><View><PerksHeading title="Leave a little room for later" action="More" onPress={() => router.push(HOME_LEDGERS.bars.href)} />
      <AuroraList testID="home-later-list">{bars.slice(0, 2).map((entry, index) => <AuroraEntryRow key={entry.kind + ':' + entry.id} testID="daybreak-home-row" divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList>
    </View>{vee}</View> : vee}
    <SectionRule />
    <View><PerksHeading title="For you" action="See all" onPress={() => router.push('/home/ideas')} />
      <HRow gap={12}>{ideas.map(idea => <HomeDoorCard key={idea.id} variant="tile" testID={`home-idea-${idea.id}`} title={idea.title} meta={idea.detail}
        image={homeIdeaPhoto(idea, catalog)} photos={homeIdeaPhotos(idea, catalog)} glyph={idea.glyph} onPress={() => router.push(idea.href as never)} />)}</HRow>
    </View>
    {catalog.collections.length ? <><SectionRule /><View><PerksHeading title="Collections" action="See all" onPress={() => router.push('/home/collections')} />
      <HRow gap={12}>{catalog.collections.map(collection => <HomeDoorCard key={collection.id} variant="banner" testID={`home-collection-${collection.id}`}
        title={collection.title} meta={`${collection.items.length} picks · ${collection.subtitle.split(' · ').slice(-1)[0]}`} image={collection.coverImage} photos={homeCollectionPhotos(collection.id, catalog)} glyph={homeCollectionGlyph(collection.id)}
        onPress={() => router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />)}</HRow>
    </View></> : null}
  </ScreenScroll></Screen>;
}
