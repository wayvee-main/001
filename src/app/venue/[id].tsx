import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailFactList, DetailIconButton, DetailInfoRow } from '@/components/detail';
import {
  DetailScreen,
  type DetailDisclosure,
  type DetailScreenAction,
  type DetailSection,
} from '@/components/detail-screen';
import { Screen } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedView } from '@/components/raised-surface';
import { BackButton, ChevronRight } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { VENUES, currentEventListings } from '@/lib/data';
import { mapsDirectionsLink } from '@/lib/links';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

const CALENDAR = 'M6 3v3 M18 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z M7 11h3v3H7z';
const HEART = 'M20.84 4.61a5.5 5.5 0 0 0 -7.78 0l-1.06 1.06l-1.06 -1.06a5.5 5.5 0 0 0 -7.78 7.78l1.06 1.06l7.78 7.78l7.78 -7.78l1.06 -1.06a5.5 5.5 0 0 0 0 -7.78z';
const BELL = 'M18 8a6 6 0 0 0 -12 0c0 7 -3 7 -3 9h18c0 -2 -3 -2 -3 -9 M10 21h4';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return Object.keys(VENUES).map((id) => ({ id }));
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceLocation, followedVenues, isSaved, showToast, toggleFollow, toggleSaved } = useScoper();
  const colors = useThemeColors();
  const venue = VENUES[id ?? ''];

  if (!venue) {
    return (
      <Screen>
        <View className="flex-1 px-5">
          <BackButton />
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <Text className="font-fraunces text-display text-ink">Venue unavailable</Text>
            <Text className="mt-2 text-center font-dm text-body text-taupe">
              This venue may have changed or the link may be out of date.
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.replace('/discover')}
              className="mt-5 rounded-full bg-ember px-6 py-3">
              <Text className="font-dm-medium text-body text-white">Browse Discover</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  const openCalendar = () => {
    Linking.openURL(venue.sourceUrl).catch(() => showToast('Could not open the official calendar'));
  };
  const venueEvents = currentEventListings().filter((event) => event.venueId === venue.id);
  const saved = isSaved('venue', venue.id);
  const following = followedVenues.includes(venue.id);

  // The Events/About tabs are gone: what is on is why you are here, so it is
  // the page, and the venue's own facts fold into a row underneath. The search
  // field over that list went too — it filtered a handful of listings that
  // already fit on one screen.
  const sections: DetailSection[] = venueEvents.length
    ? [{
        key: 'whats-on',
        title: 'What’s on',
        note: venueEvents.length === 1 ? '1 official listing' : `${venueEvents.length} official listings`,
        children: (
          <RaisedView className="overflow-hidden rounded-card px-3.5">
            {venueEvents.map((event, index) => (
              <TouchableOpacity
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`${event.name}, ${event.date}, ${event.time}, ${event.priceLabel}`}
                activeOpacity={0.72}
                onPress={() => router.push(`/event/${event.id}`)}
                className={`flex-row items-center gap-x-2.5 py-2.5 ${index < venueEvents.length - 1 ? 'border-b border-sand' : ''}`}>
                <Photo uri={event.image} radius={8} style={{ width: 44, height: 44 }} />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center justify-between gap-x-2">
                    <Text numberOfLines={1} className="shrink font-dm-bold text-micro tracking-[0.4px] text-peach">
                      {event.date.split('·')[0].trim().toUpperCase()}
                    </Text>
                    <Text numberOfLines={1} className="shrink-0 font-dm-medium text-micro text-pine">{event.priceLabel}</Text>
                  </View>
                  <Text numberOfLines={1} className="mt-0.5 font-dm-bold text-label text-ink">{event.name}</Text>
                  <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{event.time}</Text>
                </View>
                <ChevronRight color={colors.peach} strokeWidth={1.8} />
              </TouchableOpacity>
            ))}
          </RaisedView>
        ),
      }]
    : [{
        key: 'no-listings',
        children: (
          <DetailInfoRow
            iconD={CALENDAR}
            label="Calendar"
            value="See current official listings"
            onPress={openCalendar}
          />
        ),
      }];

  const rows: DetailDisclosure[] = venue.detailFacts.length
    ? [{
        key: 'know',
        glyph: 'bolt',
        label: 'Good to know',
        summary: venue.detailFacts.map((fact) => fact.label).join(' · '),
        children: <DetailFactList facts={venue.detailFacts} />,
      }]
    : [];

  const actions: DetailScreenAction[] = [
    { label: 'Official calendar', iconD: CALENDAR, onPress: openCalendar },
    {
      label: 'Plan a night',
      iconD: ICON_PATHS.sparkles,
      onPress: () =>
        router.push(`/create?venueId=${venue.id}&q=${encodeURIComponent(`Dinner before a show at ${venue.name}`)}`),
    },
  ];

  return (
    <DetailScreen
      image={venue.image}
      heroActions={
        <>
          <DetailIconButton
            d={HEART}
            label={saved ? `Remove ${venue.name} from saved places` : `Save ${venue.name}`}
            active={saved}
            fill={saved ? colors.peach : 'none'}
            onPress={() => toggleSaved('venue', venue.id, venue.name)}
          />
          <DetailIconButton
            d={BELL}
            label={following ? `Stop following ${venue.name}` : `Follow ${venue.name}`}
            active={following}
            activeClassName="bg-sage"
            color={following ? colors.pine : colors.peach}
            onPress={() => toggleFollow(venue.id, venue.name)}
          />
        </>
      }
      title={venue.name}
      meta={venue.detailMeta}
      address={venue.address}
      onAddress={() =>
        Linking.openURL(mapsDirectionsLink(venue.address, deviceLocation ?? undefined)).catch(() =>
          showToast('Could not open Maps'),
        )
      }
      sections={sections}
      rows={rows}
      sourceUrl={venue.sourceUrl}
      sourceLabel="Official site"
      actions={actions}
      navActive="discover"
    />
  );
}
