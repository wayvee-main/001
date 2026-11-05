import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CitySearchBar } from '@/components/city-controls';
import { AuroraLinkRow, AuroraList, SectionRule } from '@/components/aurora';
import { StubPoster, StubRail, StubTicket } from '@/components/stub-cards';
import { DaybreakFeature, DaybreakIntro, DaybreakPeriodPicker, type DaybreakPeriod } from '@/components/daybreak';
import { QuietHomeHeading, QuietHomeOffers, QuietHomeVee } from '@/components/quiet-home';
import { Screen, ScreenScroll } from '@/components/layout';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksHeader } from '@/components/local-perks';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { metadataParts } from '@/lib/card-presentation';
import { homeGuideHref, homeIdeaPhoto } from '@/lib/home-guide';
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
    <View style={{ gap: 14, marginTop: -4 }}>
      <HomeTimelyRecommendations catalog={catalog} now={now} />
      <CitySearchBar variant="aurora" testID="home-search" labelTestID="home-search-label" city={displayCity} onPress={() => router.push('/search')} />
    </View>
    <LocalCategoryShelf catalog={catalog} />
    {/* Three ruled zones: now (the period, its pick, the perks it could
      * sweeten), yours (later tonight, ideas), and browse (collections, then
      * Vee to close the page for anyone still deciding). */}
    <View testID="quiet-home-feed" style={{ gap: 30 }}>
      <View style={{ gap: 16 }}>
        <SectionRule spacing={0} testID="home-period-rule" />
        <DaybreakPeriodPicker value={period} onChange={setPeriodOverride} />
        {feature ? <View style={{ marginTop: 6 }}><QuietHomeHeading title="Start here" meta={period === 'evening' ? 'Picked for after hours' : 'Picked for the day'} />
          <DaybreakFeature entry={feature} catalog={catalog} now={now} />
        </View> : null}
        <QuietHomeOffers />
      </View>
      <View style={{ gap: 28 }}>
        <SectionRule spacing={0} testID="home-yours-rule" />
        {bars.length ? <View><QuietHomeHeading title="For later" meta={`${bars.length} ${bars.length === 1 ? 'bar' : 'bars'}`} onMore={() => router.push(HOME_LEDGERS.bars.href)} />
          <StubRail testID="home-later-list">{bars.slice(0, 6).map(entry => {
            const kind = entry.caption.split(' · ')[0], place = entry.facts.find(fact => fact.glyph === 'pin')?.value, hours = entry.facts.find(fact => fact.glyph === 'clock')?.value;
            return <StubTicket key={entry.kind + ':' + entry.id} testID="daybreak-home-row" lead={{ kind: 'thumb' }} title={entry.name} caption={hours || kind}
              pills={[{ text: kind, glyph: 'drink' }, ...(place ? [{ text: place, glyph: 'pin' }] : [])]}
              photo={{ candidates: homeIndexPhotos(entry, catalog), glyph: entry.glyph, label: `${entry.name} photo unavailable` }}
              onPress={() => router.push(homeGuideHref(entry) as never)} accessibilityLabel={[entry.name, entry.caption, hours].filter(Boolean).join('. ')} />;
          })}</StubRail>
        </View> : null}
        <View><QuietHomeHeading title="For you" meta={`${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}`} onMore={() => router.push('/home/ideas')} />
          <AuroraList testID="quiet-home-ideas">{ideas.map((idea, index) => <AuroraLinkRow key={idea.id} testID={`home-idea-${idea.id}`} divider={index > 0} title={idea.title} glyph={idea.glyph}
            image={homeIdeaPhoto(idea, catalog)} photos={homeIdeaPhotos(idea, catalog)} meta={metadataParts(idea.detail).slice(0, 2).join(' · ')}
            accessibilityLabel={`${idea.title}. ${idea.detail}`} onPress={() => router.push(idea.href as never)} />)}</AuroraList>
        </View>
      </View>
      <View style={{ gap: 24 }}>
        <SectionRule spacing={0} testID="home-browse-rule" />
        {catalog.collections.length ? <View><QuietHomeHeading title="Collections" meta={`${catalog.collections.length} to browse`} onMore={() => router.push('/home/collections')} />
          <StubRail testID="quiet-home-collections">{catalog.collections.map(collection => {
            const glyph = homeCollectionGlyph(collection.id), count = collection.items.length;
            return <StubPoster key={collection.id} testID={`home-collection-${collection.id}`} title={collection.title} caption={collection.description}
              pills={[{ text: `${count} ${count === 1 ? 'pick' : 'picks'}`, glyph }, ...(collection.eyebrow ? [{ text: collection.eyebrow.charAt(0) + collection.eyebrow.slice(1).toLowerCase() }] : [])]}
              photo={{ uri: collection.coverImage || undefined, candidates: homeCollectionPhotos(collection.id, catalog), glyph, label: `${collection.title} photo unavailable` }}
              accessibilityLabel={`${collection.title}. ${count} picks. ${collection.subtitle}`}
              onPress={() => router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />;
          })}</StubRail>
        </View> : null}
        <QuietHomeVee />
      </View>
    </View>
  </ScreenScroll></Screen>;
}
