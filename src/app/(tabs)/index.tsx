import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { CitySearchBar } from '@/components/city-controls';
import { AuroraEntryRow, AuroraLinkRow, AuroraList, SectionRule } from '@/components/aurora';
import { CityDeskCalmPair, CityDeskHomeIntro, CityDeskPoster, CityDeskPosterGrid, CityDeskSection, CityDeskWeather } from '@/components/city-desk';
import { DaybreakPeriodPicker, type DaybreakPeriod } from '@/components/daybreak';
import { QuietHomeOffers, QuietHomeVee } from '@/components/quiet-home';
import { Screen, ScreenScroll } from '@/components/layout';
import { HomeTimelyRecommendations, LocalPerksHeader } from '@/components/local-perks';
import { EmptyState } from '@/components/ui';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { metadataParts } from '@/lib/card-presentation';
import { homeGuideKey, homeIdeaPhoto } from '@/lib/home-guide';
import { homeCollectionPhotos, homeIdeaPhotos, homeIndexPhotos } from '@/lib/home-index-photos';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { eventsLeadNow } from '@/lib/daypart';
import { perksEntries, perksFeaturedEntries } from '@/lib/local-perks';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { useHomeGuide } from '@/lib/use-home-guide';
import { useThemeColors } from '@/lib/theme';
import { hydrateWeatherFromBackend } from '@/lib/weather';

export default function HomeScreen() {
  const router = useRouter(), colors = useThemeColors(), { catalog, now, displayCity, refreshRegional } = useHomeGuide();
  const refreshLocation = useScoper(s => s.refreshLocation), [refreshing, setRefreshing] = useState(false);
  const [periodOverride, setPeriodOverride] = useState<DaybreakPeriod | null>(null);
  const period = periodOverride || (eventsLeadNow(now) ? 'evening' : 'day');
  const ideas = homeDiscoveryIdeas(now), tables = perksFeaturedEntries(catalog, 'eat'), bars = perksEntries(catalog, 'bars'), events = perksEntries(catalog, 'events');
  const table = tables.find(entry => homeIndexPhotos(entry, catalog).length && (entry.detailContent?.menu?.items.length || entry.detailContent?.menuDocuments?.length)) || tables.find(entry => homeIndexPhotos(entry, catalog).length) || tables[0];
  const feature = period === 'evening' ? events.find(entry => entry.image) || table || bars[0] : table || perksEntries(catalog, 'routes')[0];
  const second = (period === 'evening' ? bars : tables).find(entry => !feature || homeGuideKey(entry.kind, entry.id) !== homeGuideKey(feature.kind, feature.id));
  const picks = [feature, second].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), refreshLocation(), refreshRegional()]); }
    finally { setRefreshing(false); }
  };
  return <Screen><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader appearance="citydesk" location={false} subline={<CityDeskWeather city={displayCity} />} />
    <CityDeskHomeIntro now={now} />
    <CitySearchBar variant="citydesk" testID="home-search" labelTestID="home-search-label" city={displayCity} onPress={() => router.push('/search')} />
    <HomeTimelyRecommendations compact catalog={catalog} now={now} />
    <View testID="quiet-home-feed" style={{ gap: 24 }}>
      <View style={{ gap: 13 }}>
        <SectionRule spacing={0} testID="home-period-rule" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text accessibilityRole="header" className="font-dm-medium" style={{ fontSize: 11, lineHeight: 16, letterSpacing: 1, color: colors['fg-muted'] }}>YOUR NEXT STOP</Text>
          <DaybreakPeriodPicker compact appearance="citydesk" value={period} onChange={setPeriodOverride} />
        </View>
        {picks.length ? <CityDeskCalmPair entries={picks} catalog={catalog} now={now} />
          : <EmptyState compact title="Your next good stop is on the way" message="Try another category or check back as local listings arrive." />}
        <QuietHomeOffers appearance="citydesk" />
      </View>
      <CityDeskSection title="For you" onMore={() => router.push('/home/ideas')}>
        <AuroraList compact testID="quiet-home-ideas">{ideas.map((idea, index) => <AuroraLinkRow compact key={idea.id} testID={`home-idea-${idea.id}`} divider={index > 0} title={idea.title} glyph={idea.glyph}
          image={homeIdeaPhoto(idea, catalog)} photos={homeIdeaPhotos(idea, catalog)} meta={metadataParts(idea.detail).slice(0, 2).join(' · ')}
          accessibilityLabel={`${idea.title}. ${idea.detail}`} onPress={() => router.push(idea.href as never)} />)}</AuroraList>
      </CityDeskSection>
      {bars.length ? <CityDeskSection title="For later" onMore={() => router.push(HOME_LEDGERS.bars.href)}>
        <AuroraList compact testID="home-later-list">{bars.slice(0, 3).map((entry, index) => <AuroraEntryRow compact key={homeGuideKey(entry.kind, entry.id)} testID="home-later-row" entry={entry} divider={index > 0} catalog={catalog} now={now} />)}</AuroraList>
      </CityDeskSection> : null}
      {catalog.collections.length ? <CityDeskSection title="Collections" onMore={() => router.push('/home/collections')}>
        <CityDeskPosterGrid>{width => catalog.collections.slice(0, 4).map(collection => <CityDeskPoster key={collection.id} width={width} title={collection.title} caption={collection.description}
          count={collection.items.length} glyph={homeCollectionGlyph(collection.id)} photos={homeCollectionPhotos(collection.id, catalog)}
          onPress={() => router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />)}</CityDeskPosterGrid>
      </CityDeskSection> : null}
      <QuietHomeVee appearance="citydesk" />
    </View>
  </ScreenScroll></Screen>;
}
