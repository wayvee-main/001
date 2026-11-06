import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { type HubFact } from '@/components/featured';
import { StubStack, StubTicket } from '@/components/stub-cards';
import { dateLead } from '@/lib/stub-cards';
import { Glyph } from '@/components/glyph';
import { RaisedTouchable } from '@/components/raised-surface';
import { SeeAllScreen } from '@/components/see-all';
import { ChevronRight, EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { currentEventListings, eventDayGroupLabel, isEventToday, type ScoperEvent } from '@/lib/data';
import { composedTitle } from '@/lib/hub-copy';
import { useThemeColors } from '@/lib/theme';

/**
 * What "Tonight in Oakland" on Home opens.
 *
 * It used to switch to the Discover tab. Three of Home's four See-all links
 * push a screen with a back button; only this one moved the tab pill, which is
 * why it alone felt like it needed a transition to soften. Pushed like the
 * others there is no discontinuity left to design around — back returns you to
 * Home, mid-scroll, where you were.
 *
 * The Discover tab is still the deeper cut, and the row at the bottom says so:
 * this screen answers the question, the tab is there when the question grows
 * into searching and filtering.
 */
export default function TonightScreen() {
  const router = useRouter();
  const now = useNow(60_000);
  const colors = useThemeColors();

  // Tonight first, then everything else still ahead — the same listing pool
  // Discover reads, so the two can never disagree about what is on.
  const { tonight, later } = useMemo(() => {
    const listings = currentEventListings(now);
    return {
      tonight: listings.filter((event: ScoperEvent) => isEventToday(event, now)),
      later: listings.filter((event: ScoperEvent) => !isEventToday(event, now)),
    };
  }, [now]);

  const facts: HubFact[] = [];
  if (tonight.length) facts.push({ glyph: 'ticket', label: `${tonight.length} tonight`, tone: 'accent' });
  if (later.length) facts.push({ glyph: 'calendar', label: `${later.length} still ahead` });

  // Each show as a date ticket: the calendar tile carries the day, so the
  // words only need the venue, the doors and the price.
  const row = (event: ScoperEvent) => (
    <StubTicket
      key={event.id}
      testID="tonight-event"
      lead={dateLead(event.startsAt) || { kind: 'thumb' }}
      title={event.name}
      caption={[event.venue, ...event.date.split('·').slice(1).map(part => part.trim())].filter(Boolean).join(' · ') || event.time}
      accent={event.priceLabel}
      photo={{ uri: event.image, glyph: 'ticket', label: `No photo for ${event.name}` }}
      width="full"
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityLabel={[event.name, eventDayGroupLabel(event), event.time, event.venue, event.priceLabel].filter(Boolean).join('. ')}
    />
  );

  const shown = tonight.length ? tonight : later;

  return (
    <SeeAllScreen
      title={composedTitle(tonight.length ? 'Tonight' : 'Coming up', shown.length)}
      glyph="ticket"
      facts={facts}>
      {shown.length ? (
        <StubStack testID="tonight-events">{shown.map(row)}</StubStack>
      ) : (
        <EmptyState
          title="Nothing dated is on right now"
          message="Listings appear here as venues publish them."
        />
      )}

      {/* The handoff, not a duplicate: this screen is the answer, the tab is
          where the question grows into search, segments and filters. */}
      <RaisedTouchable
        accessibilityRole="button"
        accessibilityLabel="Browse all of Tonight, with search and filters"
        activeOpacity={0.72}
        onPress={() => router.push('/category?id=shows')}
        className="flex-row items-center justify-between rounded-card px-3.5 py-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-x-3">
          <Glyph name="compass" size={17} color={colors.rust} strokeWidth={1.7} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} className="font-dm-medium text-[14px] text-ink">Browse all of Tonight</Text>
            <Text numberOfLines={1} className="mt-0.5 font-dm text-label text-taupe">
              Search artists and venues, or switch to nightlife
            </Text>
          </View>
        </View>
        <ChevronRight />
      </RaisedTouchable>

      <Text className="text-center font-dm text-[10px] leading-[14px] text-taupe">
        Dates and prices come from each venue&apos;s own listing. Confirm before booking.
      </Text>
    </SeeAllScreen>
  );
}
