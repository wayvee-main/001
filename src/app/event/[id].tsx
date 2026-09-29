import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { DetailFactList, DetailIconButton } from '@/components/detail';
import {
  DetailScreen,
  whyRow,
  type DetailDisclosure,
  type DetailScreenAction,
  type DetailSection,
} from '@/components/detail-screen';
import { Screen } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedView } from '@/components/raised-surface';
import { BackButton, EmptyState } from '@/components/ui';
import { DaylightBudgetBar, RunOfShowRail } from '@/components/visual-depictions';
import { useNow } from '@/lib/clock';
import { ICON_PATHS } from '@/lib/icons';
import { EVENTS, RESTAURANTS, currentEventListings, eventDayGroupLabel, isCurrentEvent } from '@/lib/data';
import { eventFacts, eventLiveLine } from '@/lib/detail-facts';
import { milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
import { clockLabel, openStateFor } from '@/lib/hours';
import { mapsSearchLink, streetAddress, ticketLink } from '@/lib/links';
import { useCuratedCoords, useCuratedHours } from '@/lib/places';
import { computeDinnerTime } from '@/lib/plan-engine';
import { useScoper } from '@/lib/store';
import { eventHaystack, profileAffinity } from '@/lib/taste';
import { useTasteProfile } from '@/lib/use-taste-profile';
import { useThemeColors } from '@/lib/theme';
import { useDaylightRemaining } from '@/lib/weather';

const CALENDAR = 'M6 3v3 M18 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z M7 11h3v3H7z';
const TICKET = 'M15 5v2 M15 11v2 M15 17v2 M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4V7a2 2 0 0 1 2 -2z';

/** How many dinner options a pre-show shortlist shows. Three is the design's
 * count and the point at which "nearest open kitchens" stops being a shortlist. */
const DINNER_PICK_COUNT = 3;
/** Only count down to a start this close — past it, "starts in 3 days" is a
 * date, not a live fact, and the date line already says it. */
const COUNTDOWN_WINDOW_MIN = 12 * 60;

function shortDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function timeLabel(date: Date): string {
  return clockLabel(date.getHours() * 60 + date.getMinutes());
}

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Preserve a useful handoff for old bookmarks without rendering expired event details.
  return Object.keys(EVENTS).map((id) => ({ id }));
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceLocation, isPlanned, showToast, togglePlan, walkBudgetMinutes } = useScoper();
  const colors = useThemeColors();
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const profile = useTasteProfile();
  const now = useNow();
  const daylight = useDaylightRemaining(now);
  const ev = EVENTS[id ?? ''];

  const startsAt = useMemo(() => {
    const parsed = ev?.startsAt ? new Date(ev.startsAt) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }, [ev]);

  // The venue's real coordinates, matched by name + street address against the
  // synced places table. Null whenever that match isn't confident — every
  // distance below then renders as nothing rather than as a guess.
  const venuePoint = useMemo(
    () => (ev ? curatedCoords({ name: ev.venue, address: streetAddress(ev.addr) }) : null),
    [curatedCoords, ev],
  );
  const walkFromYou = (() => {
    const anchor = usableAnchor(deviceLocation);
    return anchor && venuePoint ? walkMinutes(milesBetween(anchor, venuePoint)) : null;
  })();

  // Kitchens that are open at the hour dinner would actually happen — the same
  // computeDinnerTime the planner uses, so "before the show" means the same
  // thing here as it does on the Plan tab.
  const dinnerAt = useMemo(() => (startsAt ? computeDinnerTime(ev ?? null, startsAt) : null), [ev, startsAt]);
  const dinnerPicks = useMemo(() => {
    if (!venuePoint || !dinnerAt) return [];
    return Object.values(RESTAURANTS)
      .flatMap((restaurant) => {
        const point = curatedCoords(restaurant);
        if (!point) return [];
        const state = openStateFor(curatedHours(restaurant), dinnerAt);
        if (state.status !== 'open') return [];
        return [{ restaurant, minutes: walkMinutes(milesBetween(venuePoint, point)), closesAt: state.closesAt }];
      })
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, DINNER_PICK_COUNT);
  }, [curatedCoords, curatedHours, dinnerAt, venuePoint]);

  const otherNights = useMemo(
    () => (ev?.venueId ? currentEventListings(now).filter((entry) => entry.venueId === ev.venueId && entry.id !== ev.id) : []),
    [ev, now],
  );

  const affinity = useMemo(() => (ev ? profileAffinity(eventHaystack(ev), profile) : null), [ev, profile]);

  const openUrl = async (url: string, errorMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      showToast(errorMessage);
    }
  };

  if (!ev || !isCurrentEvent(ev, now)) {
    return (
      <Screen>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
          <View className="flex-row items-center">
            <BackButton />
          </View>
          <EmptyState
            title="Event unavailable"
            message="This listing has ended or moved. Browse Discover for current official listings."
            actionLabel="Browse Discover"
            onAction={() => router.replace('/discover')}
          />
        </ScrollView>
      </Screen>
    );
  }

  const planned = isPlanned('event', ev.id);
  const hasTicketLink = ev.ticketed && Boolean(ev.ticketUrl);
  const officialActionUrl = hasTicketLink ? ticketLink(ev.ticketUrl!) : ev.sourceUrl;
  const isRsvp = !hasTicketLink && /rsvp/i.test(`${ev.priceLabel} ${ev.priceFrom}`);
  const officialActionLabel = hasTicketLink ? 'Get tickets' : isRsvp ? 'RSVP' : 'Official listing';

  // Doors are only ever read out of the listing's own date line ("Doors 7 PM ·
  // Show 8 PM"). No doors published means no doors cell — never show-time
  // minus an assumed hour.
  const doorsLabel = ev.date.match(/doors\s+([0-9:]{1,5}\s*(?:AM|PM))/i)?.[1];
  const minutesToStart = startsAt ? Math.round((startsAt.getTime() - now.getTime()) / 60_000) : null;
  const dayGroup = eventDayGroupLabel(ev, now);

  // "Sat Sep 5" out of "Sat Sep 5 · Doors 7 PM · Show 8 PM": the times in that
  // string are the fact strip's job now, so the line under the name carries
  // only the day.
  const datePart = ev.date.split('·')[0].trim();
  const metaLine = dayGroup === 'Tonight' ? `Tonight · ${datePart}` : datePart;

  // Outdoor listings are the only ones daylight changes the answer for, and
  // only on the day itself — an outdoor show next Friday says nothing about
  // tonight's light.
  const showDaylight = Boolean(daylight && dayGroup === 'Tonight' && ev.cats.includes('Outdoor'));
  const lightPastStart =
    daylight && startsAt ? Math.round((daylight.endsAt.getTime() - startsAt.getTime()) / 60_000) : null;
  const daylightLine =
    lightPastStart == null
      ? undefined
      : lightPastStart > 0
        ? `About ${shortDuration(lightPastStart)} of light left once it starts at ${ev.time}.`
        : `Dark before the ${ev.time} start — this one runs after last light.`;

  const sections: DetailSection[] = [];

  if (showDaylight && daylight) {
    sections.push({
      key: 'daylight',
      children: (
        <DaylightBudgetBar
          now={now}
          startsAt={daylight.startsAt}
          endsAt={daylight.endsAt}
          minutesLeft={daylight.minutesLeft}
          computedLine={daylightLine}
        />
      ),
    });
  }

  // Screen 9's run of show — rendered only for events whose official listing
  // published set times. Most haven't, and an invented 7:30 support slot on
  // every show is worse than no section at all.
  if (ev.runOfShow?.length) {
    sections.push({
      key: 'run-of-show',
      children: <RunOfShowRail slots={ev.runOfShow} footnote={`Set times as published by ${ev.venue}.`} />,
    });
  }

  if ((ev.vibeTags ?? []).length) {
    sections.push({
      key: 'tags',
      children: (
        <View className="flex-row flex-wrap gap-1.5">
          {(ev.vibeTags ?? []).map((tag) => (
            <View key={tag} className="rounded-full border border-sand bg-shell px-[11px] py-1.5">
              <Text className="font-dm text-meta text-ink">{tag}</Text>
            </View>
          ))}
        </View>
      ),
    });
  }

  if (dinnerPicks.length && dinnerAt) {
    sections.push({
      key: 'dinner',
      title: 'Dinner before',
      note: `open at ${timeLabel(dinnerAt)}`,
      footnote: `Walk times measured from ${ev.venue}. Open state read from each kitchen’s published hours.`,
      children: (
        <RaisedView className="overflow-hidden rounded-card px-3.5">
          {dinnerPicks.map((pick, index) => (
            <TouchableOpacity
              key={pick.restaurant.id}
              accessibilityRole="link"
              accessibilityLabel={`${pick.restaurant.name}, ${pick.minutes} minute walk from ${ev.venue}`}
              activeOpacity={0.72}
              onPress={() => router.push(`/restaurant/${pick.restaurant.id}`)}
              className={`flex-row items-center gap-x-3 py-2.5 ${index < dinnerPicks.length - 1 ? 'border-b border-sand' : ''}`}>
              <Photo uri={pick.restaurant.image} radius={9} style={{ width: 44, height: 44 }} />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-dm-bold text-label text-ink">{pick.restaurant.name}</Text>
                <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                  {pick.restaurant.cuisine} · {pick.restaurant.price} · {pick.minutes} min from {ev.venue}
                </Text>
              </View>
              {pick.closesAt ? <Text className="font-dm-medium text-meta text-pine">till {pick.closesAt}</Text> : null}
            </TouchableOpacity>
          ))}
        </RaisedView>
      ),
    });
  }

  if (otherNights.length) {
    sections.push({
      key: 'more-at-venue',
      title: `More at ${ev.venue}`,
      action: ev.venueId ? 'All nights' : undefined,
      onAction: ev.venueId ? () => router.push(`/venue/${ev.venueId}`) : undefined,
      children: (
        <RaisedView className="overflow-hidden rounded-card px-3.5">
          {otherNights.slice(0, 4).map((entry, index, shown) => (
            <TouchableOpacity
              key={entry.id}
              accessibilityRole="link"
              accessibilityLabel={`${entry.name}, ${entry.date}, ${entry.priceLabel}`}
              activeOpacity={0.72}
              onPress={() => router.push(`/event/${entry.id}`)}
              className={`flex-row items-center gap-x-3 py-2.5 ${index < shown.length - 1 ? 'border-b border-sand' : ''}`}>
              <View className="w-[52px] shrink-0">
                <Text className="font-dm-bold text-micro tracking-[0.4px] text-peach">
                  {entry.date.split('·')[0].trim().toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-dm-bold text-label text-ink">{entry.name}</Text>
                <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{entry.time}</Text>
              </View>
              <Text className="font-dm-medium text-meta text-pine">{entry.priceLabel}</Text>
            </TouchableOpacity>
          ))}
        </RaisedView>
      ),
    });
  }

  // What is left once the strip has the times and admission, the meta line has
  // the day, and the lede has the listing's own note.
  const knowFacts = [
    ...(hasTicketLink && ev.ticketProvider ? [{ label: 'Tickets', value: ev.ticketProvider }] : []),
    ...(ev.lineup && ev.lineup !== ev.name ? [{ label: 'Lineup', value: ev.lineup }] : []),
    { label: 'Doors', value: ev.date },
    { label: 'Verified', value: ev.verifiedLabel },
  ];

  const rows: DetailDisclosure[] = [
    { key: 'know', glyph: 'bolt', label: 'Good to know',
      summary: knowFacts.map((fact) => fact.label).join(' · '),
      children: <DetailFactList facts={knowFacts} /> },
    ...whyRow(ev.name, affinity),
  ];

  const actions: DetailScreenAction[] = [
    {
      label: officialActionLabel,
      iconD: TICKET,
      onPress: () =>
        void openUrl(
          officialActionUrl,
          hasTicketLink ? 'Could not open the official ticket page' : 'Could not open the official event listing',
        ),
    },
    {
      label: 'Plan a night',
      iconD: ICON_PATHS.sparkles,
      onPress: () =>
        router.push(`/create?eventId=${ev.id}&q=${encodeURIComponent(`Dinner then show ${ev.name} at ${ev.venue}`)}`),
    },
  ];

  return (
    <DetailScreen
      image={ev.image}
      heroActions={
        <DetailIconButton
          d={CALENDAR}
          label={planned ? `Remove ${ev.name} from plans` : `Add ${ev.name} to plans`}
          active={planned}
          activeClassName="bg-sage"
          color={planned ? colors.pine : colors.peach}
          onPress={() => togglePlan('event', ev.id, ev.name)}
        />
      }
      title={ev.name}
      meta={metaLine}
      address={`${ev.venue} · ${streetAddress(ev.addr)}`}
      onAddress={() =>
        ev.venueId
          ? router.push(`/venue/${ev.venueId}`)
          : void openUrl(mapsSearchLink(streetAddress(ev.addr)), 'Could not open Maps')
      }
      live={eventLiveLine({
        minutesToStart,
        windowMinutes: COUNTDOWN_WINDOW_MIN,
        walkMinutes: walkFromYou,
        walkBudgetMinutes,
        venue: ev.venue,
      })}
      facts={eventFacts({
        doorsLabel,
        startLabel: ev.time,
        priceLabel: ev.priceLabel,
        travel: walkFromYou == null ? ev.travel : undefined, // a measured walk is already in the live line
      })}
      lede={ev.know}
      sections={sections}
      rows={rows}
      sourceUrl={ev.sourceUrl}
      sourceLabel="Check the official listing"
      actions={actions}
      navActive="discover"
    />
  );
}
