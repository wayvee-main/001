import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { JournalHeading } from '@/components/detail-journal';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HomeChapterHeader, HomeChapterTitle } from '@/components/home-chapters';
import { StubStack, StubTicket } from '@/components/stub-cards';
import { EmptyState } from '@/components/ui';
import { RESTAURANTS, currentEventListings } from '@/lib/data';
import { entriesForHomeCollection, homeGuideHref, homeGuideKey } from '@/lib/home-guide';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import { dateLead } from '@/lib/stub-cards';
import { useHomeGuide } from '@/lib/use-home-guide';

/** Minutes from a listed walk ("8 min walk"); places without one sort last. */
const walkMinutes = (label?: string) => Number(label?.match(/(\d+)\s*min walk/i)?.[1] ?? Infinity);

/** A collection as its places — photo tickets, shortest listed walk first —
 * then, for a collection tied to a venue, what's on there next. */
export default function HomeCollectionScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>(), { catalog, now, displayCity } = useHomeGuide(), router = useRouter();
  const collection = catalog.entries[homeGuideKey('collection', id)], meta = catalog.collections.find(item => item.id === id);
  const notes = new Map((meta?.items || []).map(item => [homeGuideKey(item.type, item.id), item.note]));
  const places = entriesForHomeCollection(catalog, id)
    .map(entry => ({ entry, restaurant: entry.kind === 'restaurant' ? RESTAURANTS[entry.id] : undefined }))
    .sort((a, b) => walkMinutes(a.restaurant?.distanceLabel) - walkMinutes(b.restaurant?.distanceLabel));
  const shows = meta?.venueId ? currentEventListings(now).filter(event => event.venueId === meta.venueId).slice(0, 3) : [];
  return <HomeGuideScreen now={now} cityLabel={displayCity} header={false} context={false}>
    <HomeChapterHeader city={displayCity} />
    <HomeChapterTitle title={collection?.name || meta?.title || 'Collection unavailable'} subtitle={meta?.description || `Collection · ${displayCity}`} />
    {places.length ? <View style={{ gap: 10 }}>
      <JournalHeading title={`${places.length} ${places.length === 1 ? 'place' : 'places'}`} />
      <StubStack testID="collection-places">{places.map(({ entry, restaurant }) => <StubTicket key={entry.kind + ':' + entry.id} testID="collection-place" lead={{ kind: 'thumb' }}
        title={entry.name} caption={notes.get(homeGuideKey(entry.kind, entry.id)) || entry.caption}
        pills={[...(restaurant?.distanceLabel ? [{ text: restaurant.distanceLabel, glyph: 'walk' }] : []), ...(restaurant?.price ? [{ text: restaurant.price }] : [{ text: entry.caption.split(' · ')[0] }])]}
        photo={{ candidates: homeIndexPhotos(entry, catalog), glyph: entry.glyph, label: `${entry.name} photo unavailable` }} width="full"
        onPress={() => router.push(homeGuideHref(entry) as never)} accessibilityLabel={[entry.name, notes.get(homeGuideKey(entry.kind, entry.id)), restaurant?.distanceLabel].filter(Boolean).join('. ')} />)}</StubStack>
    </View> : <EmptyState compact title="No current picks" message="Try another collection from Home." />}
    {shows.length ? <View style={{ gap: 10 }}>
      <JournalHeading title="Then the show" />
      <StubStack testID="collection-shows">{shows.map(event => <StubTicket key={event.id} lead={dateLead(event.startsAt) || { kind: 'thumb' }} title={event.name}
        caption={[event.venue, ...event.date.split('·').slice(1).map(part => part.trim())].filter(Boolean).join(' · ')} accent={event.priceLabel}
        photo={{ uri: event.image, glyph: 'ticket', label: `No photo for ${event.name}` }} width="full"
        onPress={() => router.push(`/home/detail?kind=event&id=${encodeURIComponent(event.id)}` as never)} accessibilityLabel={`${event.name}. ${event.date}`} />)}</StubStack>
    </View> : null}
  </HomeGuideScreen>;
}
