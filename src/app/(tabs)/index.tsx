import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CitySearchBar } from '@/components/city-controls';
import { AuroraEntryRow, AuroraLinkRow, AuroraList, SectionRule } from '@/components/aurora';
import { DaybreakFeature, DaybreakIntro, DaybreakPeriodPicker, type DaybreakPeriod } from '@/components/daybreak';
import { QuietHomeHeading, QuietHomeOffers, QuietHomeVee } from '@/components/quiet-home';
import { Screen, ScreenScroll } from '@/components/layout';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksHeader } from '@/components/local-perks';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { metadataParts } from '@/lib/card-presentation';
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
  return <Screen aurora><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader location={false} />
    <DaybreakIntro city={displayCity} />
    <View style={{ gap: 2, marginTop: -10 }}>
      <HomeTimelyRecommendations catalog={catalog} now={now} />
      <CitySearchBar variant="aurora" testID="home-search" labelTestID="home-search-label" city={displayCity} onPress={() => router.push('/search')} />
    </View>
    <View style={{ gap: 8 }}>
      <SectionRule spacing={0} testID="home-category-rule" />
      <LocalCategoryShelf catalog={catalog} />
    </View>
    <View testID="quiet-home-feed" style={{ gap: 22 }}>
      <View style={{ gap: 16 }}>
        <SectionRule spacing={0} testID="home-period-rule" />
        <DaybreakPeriodPicker value={period} onChange={setPeriodOverride} />
      </View>
      {/* Each extra sits beside what it serves: perks under the pick it could
        * sweeten, Vee after the evening's later stops, where planning starts. */}
      <View style={{ gap: 10 }}>
        {feature ? <View><QuietHomeHeading title="Start here" />
          <DaybreakFeature entry={feature} catalog={catalog} now={now} />
        </View> : null}
        <QuietHomeOffers />
      </View>
      <View style={{ gap: 10 }}>
        {bars.length ? <View><QuietHomeHeading title="For later" onMore={() => router.push(HOME_LEDGERS.bars.href)} />
          <AuroraList testID="home-later-list">{bars.slice(0, 2).map((entry, index) => <AuroraEntryRow key={entry.kind + ':' + entry.id} testID="daybreak-home-row" divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList>
        </View> : null}
        <QuietHomeVee />
      </View>
      <View><QuietHomeHeading title="For you" onMore={() => router.push('/home/ideas')} />
        <AuroraList testID="quiet-home-ideas">{ideas.map((idea, index) => <AuroraLinkRow key={idea.id} testID={`home-idea-${idea.id}`} divider={index > 0} title={idea.title} glyph={idea.glyph}
          image={homeIdeaPhoto(idea, catalog)} photos={homeIdeaPhotos(idea, catalog)} meta={metadataParts(idea.detail).slice(0, 2).join(' · ')}
          accessibilityLabel={`${idea.title}. ${idea.detail}`} onPress={() => router.push(idea.href as never)} />)}</AuroraList>
      </View>
      {catalog.collections.length ? <View><QuietHomeHeading title="Collections" onMore={() => router.push('/home/collections')} />
        <AuroraList testID="quiet-home-collections">{catalog.collections.slice(0, 2).map((collection, index) => <AuroraLinkRow key={collection.id} testID={`home-collection-${collection.id}`} divider={index > 0}
          title={collection.title} glyph={homeCollectionGlyph(collection.id)} image={collection.coverImage} photos={homeCollectionPhotos(collection.id, catalog)}
          meta={[`${collection.items.length} picks`, ...metadataParts(collection.subtitle).slice(-1)].join(' · ')}
          accessibilityLabel={`${collection.title}. ${collection.items.length} picks. ${collection.subtitle}`}
          onPress={() => router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />)}</AuroraList>
      </View> : null}
    </View>
  </ScreenScroll></Screen>;
}
