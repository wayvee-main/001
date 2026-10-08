import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { EditorialCategories, EditorialCollection, EditorialEvent, EditorialForYouHeading, EditorialHeader, EditorialHero, EditorialNearestRow, EditorialSubheading, editorialStyles } from '@/components/home-editorial';
import { Screen, ScreenScroll } from '@/components/layout';
import { useContentHydrating } from '@/lib/bootstrap';
import { useActiveCityName } from '@/lib/city';
import { useNow } from '@/lib/clock';
import { CURATED_COLLECTION_ORDER, CURATED_COLLECTIONS, activeCollectionItems, homeEventPicks, isEventToday } from '@/lib/data';
import { useEditorial } from '@/lib/editorial';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { NEAREST_HOME_LIMIT } from '@/lib/nearby-pool';
import { hydratePlacesFromBackend } from '@/lib/places';
import { activeReminders } from '@/lib/reminders';
import { useScoper } from '@/lib/store';
import { collectionHaystack, eventHaystack, profileAffinity } from '@/lib/taste';
import { useNearestPlaces } from '@/lib/use-nearest-places';
import { useTasteProfile } from '@/lib/use-taste-profile';
import { hydrateWeatherFromBackend } from '@/lib/weather';

/** Approved Editorial Home. Visual order and copy are deliberately fixed. */
export default function HomeScreen() {
  const router = useRouter();
  const s = useScoper();
  const { c, gutter } = useEditorial();
  const cityName = useActiveCityName();
  const hydrating = useContentHydrating();
  const now = useNow();
  const tasteProfile = useTasteProfile();
  const [refreshing, setRefreshing] = useState(false);
  const nearest = useNearestPlaces();
  const preview = nearest.slice(0, NEAREST_HOME_LIMIT);

  const events = useMemo(() => homeEventPicks(now)
    .map((event, index) => ({ event, index, dayRank: isEventToday(event, now) ? 0 : 1, score: profileAffinity(eventHaystack(event), tasteProfile).score + (event.venueId && s.followedVenues.includes(event.venueId) ? 3 : 0) }))
    .sort((a, b) => a.dayRank - b.dayRank || b.score - a.score || a.index - b.index)
    .map((entry) => entry.event), [now, tasteProfile, s.followedVenues]);
  const collections = useMemo(() => CURATED_COLLECTION_ORDER
    .map((id) => CURATED_COLLECTIONS[id])
    .filter((collection) => activeCollectionItems(collection, now).length > 0)
    .map((collection, index) => ({ collection, index, score: profileAffinity(collectionHaystack(collection), tasteProfile).score }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.collection), [tasteProfile, now]);
  const collection = collections.find((entry) => entry.id === 'outdoor-tables') ?? collections[0];
  const event = events[0];

  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), s.refreshLocation()]); }
    finally { setRefreshing(false); }
  };
  const food = (query?: string) => { s.resetFilters(); router.push(query ? `/featured?q=${encodeURIComponent(query)}` : '/featured'); };
  const openLate = () => { s.resetFilters(); s.toggleFlag('openLate'); router.push('/featured'); };

  return (
    <Screen backgroundColor={c.paper}>
      <ScreenScroll gap={0} refreshing={refreshing} onRefresh={refresh} contentStyle={{ maxWidth: 390, paddingHorizontal: gutter, paddingBottom: 24 }}>
        <EditorialHeader locationLabel={['Oakland', 'San Francisco'].includes(cityName) ? `${cityName}, CA` : cityName} hasReminders={activeReminders(s.plans, s.stay).length > 0} onLocation={() => router.push('/profile')} onProfile={() => router.push('/profile')} />
        <EditorialHero stayLabel={s.stay ? 'Update your stay' : 'Link your stay'} onAsk={() => s.openSheet('search')} onStay={() => s.openStaySheet()} onLateBites={() => router.push('/collection/late-night')} onOpenLate={openLate} />
        <EditorialCategories onEat={() => food()} onShows={() => router.push('/discover?mode=Events')} onBars={() => router.push('/discover?mode=Nightlife')} onRoutes={() => router.push('/collection')} />
        {event ? <View style={editorialStyles.section}><EditorialEvent event={event} now={now} onPress={() => router.push(`/event/${event.id}`)} /></View> : null}
        <View style={editorialStyles.section}>
          <EditorialForYouHeading />
          <EditorialSubheading title="Nearest" onSeeAll={() => router.push('/nearest')} />
          <View testID="editorial-nearest-preview" style={{ marginTop: 3 }}>
            {preview.length ? preview.map((entry, index) => <EditorialNearestRow key={entry.key} entry={entry} last={index === preview.length - 1} onPress={() => router.push(entry.href)} />) : <Text style={[editorialStyles.status, { color: c.muted }]}>{hydrating ? 'Loading nearby places…' : 'The local catalog is unavailable. Pull to refresh.'}</Text>}
          </View>
          {collection ? <><EditorialSubheading title="Collections" /><EditorialCollection collection={collection} onPress={() => router.push(`/collection/${collection.id}`)} /></> : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
