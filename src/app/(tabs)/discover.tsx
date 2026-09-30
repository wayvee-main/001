import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { EventMetaLine, EventPrice } from '@/components/event-meta';
import { SectionHeading } from '@/components/section-heading';
import { Photo } from '@/components/photo';
import { PlanChip } from '@/components/plan-actions';
import { POSTER_WIDTH, PosterCard, ViatorPickCard } from '@/components/poster-card';
import { RaisedTouchable, RaisedView } from '@/components/raised-surface';
import { Chip, ChevronRight, Icon, SearchIcon, Skeleton } from '@/components/ui';
import { CRAWLS, EVENTS, NIGHTLIFE_SPOTS, VENUES, currentEventListings, eventDayGroupLabel, isEventToday, upcomingEventSections, type ScoperEvent } from '@/lib/data';
import { useContentHydrating } from '@/lib/bootstrap';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { ticketLink } from '@/lib/links';
import { hydratePlacesFromBackend, useAllPlaces } from '@/lib/places';
import { buildSearchIndex, queryIndex, SEARCH_KIND_LABELS, type SearchResult, type SearchResultKind } from '@/lib/search';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { hydrateViatorPicksFromBackend, sortedViatorPicks, useViatorPicks } from '@/lib/viator';

// Discover is the only screen that surfaces the Viator roster now, so it starts
// at the top of it. This used to begin at an offset because Home showed the
// first page — remove that and the offset would have silently buried the eight
// best-ranked picks.
const DISCOVER_PICKS_COUNT = 12;

// Discover's own universe — events, venues, nightlife, and walkable routes.
// Restaurants/dishes/places intentionally stay out of scope here: the food
// hub (linked below) already owns that search in full depth.
const DISCOVER_SEARCH_KINDS: SearchResultKind[] = ['event', 'venue', 'night', 'crawl'];

const EVENT_CATS = ['Tonight', 'Upcoming', 'Live music', 'Outdoor', 'Movies'];
const MAP_ICON = 'M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13 M9 4v13 M15 7v13';

const CONTENT_MODES = ['Experiences', 'Events', 'Nightlife'] as const;
type ContentMode = (typeof CONTENT_MODES)[number];

function TrendingEventRow({
  rank,
  event,
  onPress,
  onBook,
  onPlan,
}: {
  rank: number;
  event: ScoperEvent;
  onPress: () => void;
  onBook?: () => void;
  onPlan?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <Text className="w-5 text-center font-fraunces text-[17px] text-rust">{rank}</Text>
      <TouchableOpacity accessibilityRole="button" activeOpacity={0.72} onPress={onPress} className="min-w-0 flex-1 flex-row items-center gap-x-3">
        <Photo uri={event.image} radius={10} style={{ width: 48, height: 48 }} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-dm-bold text-[13.5px] text-ink">{event.name}</Text>
          <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{eventDayGroupLabel(event)} · {event.priceLabel}</Text>
        </View>
      </TouchableOpacity>
      <View className="flex-row items-center gap-x-1.5">
        {onPlan ? <PlanChip onPress={onPlan} /> : null}
        {onBook ? (
          <TouchableOpacity accessibilityRole="link" activeOpacity={0.75} onPress={onBook} className="rounded-full border border-rust px-3 py-1.5">
            <Text className="font-dm-medium text-meta text-rust">Book</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/** Same shape as TrendingEventRow, shown while backend events are still hydrating. */
function TrendingEventRowSkeleton({ rank }: { rank: number }) {
  return (
    <View className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <Text className="w-5 text-center font-fraunces text-[17px] text-rust">{rank}</Text>
      <View className="min-w-0 flex-1 flex-row items-center gap-x-3">
        <Skeleton width={48} height={48} radius={10} />
        <View className="min-w-0 flex-1 gap-y-[7px]">
          <Skeleton width="70%" height={13} radius={4} />
          <Skeleton width="45%" height={11} radius={4} />
        </View>
      </View>
    </View>
  );
}

function EventRow({ event, onPress, onPlan }: { event: ScoperEvent; onPress: () => void; onPlan?: () => void }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`View ${event.name}`}
        activeOpacity={0.72}
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-x-3">
        <Photo uri={event.image} radius={10} style={{ width: 56, height: 56 }} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-x-2">
            <Text numberOfLines={1} className="shrink font-dm-bold text-[9.5px] tracking-[0.55px] text-peach">{eventDayGroupLabel(event).toUpperCase()}</Text>
            <EventPrice label={event.priceLabel} />
          </View>
          <Text numberOfLines={1} className="mt-1 font-dm-bold text-[14px] text-ink">{event.name}</Text>
          {/* No day here: it is the eyebrow above. This row is tighter than
              Home's — a plan chip and a chevron share the width with it. */}
          <EventMetaLine when={event.time} venue={event.venue} />
        </View>
      </TouchableOpacity>
      {onPlan ? <PlanChip onPress={onPlan} /> : null}
      <ChevronRight color={colors.peach} strokeWidth={1.8} />
    </View>
  );
}

/** Same shape as EventRow, shown while backend events are still hydrating —
 * stands in for the row itself, never for the "no listings" empty state. */
function EventRowSkeleton() {
  return (
    <View className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <Skeleton width={56} height={56} radius={10} />
      <View className="min-w-0 flex-1 gap-y-[7px]">
        <Skeleton width={64} height={9} radius={4} />
        <Skeleton width="78%" height={14} radius={4} />
        <Skeleton width="52%" height={11} radius={4} />
      </View>
    </View>
  );
}

/** Same shape as ViatorPickCard, shown while Viator picks are still hydrating. */
function ViatorPickSkeleton() {
  return (
    <RaisedView style={{ width: POSTER_WIDTH }} className="overflow-hidden rounded-card">
      <Skeleton width={POSTER_WIDTH} height={85} radius={0} />
      <View className="gap-y-[7px] px-3 py-2.5">
        <Skeleton width="72%" height={13} radius={4} />
        <Skeleton width="46%" height={11} radius={4} />
      </View>
    </RaisedView>
  );
}

/** Same row shape as EventRow (Home's "Tonight in Oakland" layout) — used for the
 * cross-category curated picks, whose source items aren't ScoperEvents. */
function CuratedRow({
  image,
  eyebrow,
  title,
  meta,
  onPress,
  onPlan,
}: {
  image?: string;
  eyebrow: string;
  title: string;
  meta: string;
  onPress: () => void;
  onPlan?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`View ${title}`}
        activeOpacity={0.72}
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-x-3">
        <Photo uri={image} radius={10} style={{ width: 58, height: 58 }} />
        <View className="min-w-0 flex-1">
          <Text className="font-dm-bold text-[9.5px] tracking-[0.55px] text-peach">{eyebrow}</Text>
          <Text numberOfLines={1} className="mt-1 font-dm-bold text-[14px] text-ink">{title}</Text>
          <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{meta}</Text>
        </View>
      </TouchableOpacity>
      {onPlan ? <PlanChip onPress={onPlan} /> : null}
      <ChevronRight color={colors.peach} strokeWidth={1.8} />
    </View>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { q, mode } = useLocalSearchParams<{ q?: string; mode?: string }>();
  const { eventCat, setEventCat, showToast, tasteTags } = useScoper();
  const colors = useThemeColors();
  const hydrating = useContentHydrating();
  const seededQuery = typeof q === 'string' ? q : '';
  const [lastSeed, setLastSeed] = useState(seededQuery);
  const [query, setQuery] = useState(seededQuery);
  if (seededQuery !== lastSeed) {
    setLastSeed(seededQuery);
    setQuery(seededQuery);
  }
  // Home's counts trail links straight to the segment it counted — a guest who
  // taps "10 bars" should land on the bars, not on Experiences with the bars
  // one tap further away. Re-seeded the same way the query is, so arriving from
  // Home again re-selects it even while this mounted tab keeps its own state.
  const seededMode = CONTENT_MODES.find((m) => m.toLowerCase() === String(mode ?? '').toLowerCase());
  const [contentMode, setContentMode] = useState<ContentMode>(seededMode ?? 'Experiences');
  const [lastMode, setLastMode] = useState(seededMode);
  if (seededMode !== lastMode) {
    setLastMode(seededMode);
    if (seededMode) setContentMode(seededMode);
  }
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([hydrateEventsFromBackend(true), hydrateViatorPicksFromBackend(true), hydratePlacesFromBackend(true)]);
    } finally {
      setRefreshing(false);
    }
  };
  const currentEvents = currentEventListings();
  const trendingEvents = currentEvents.slice(0, 2);
  // The Viator roster, top-ranked first. "See all" opens /picks, which carries
  // the same title, so the section and the screen it leads to agree.
  const allPicks = useViatorPicks();
  const discoverPicks = sortedViatorPicks(allPicks).slice(0, DISCOVER_PICKS_COUNT);
  // One featured pick from every other Discover category — same idea as Home's
  // "Tonight in Oakland" (one pick per calendar), reused here across nightlife,
  // venues, and walkable routes instead of event sources.
  const featuredNightlife = NIGHTLIFE_SPOTS[0];
  const featuredVenue = Object.values(VENUES)[0];
  const featuredCrawl = Object.values(CRAWLS)[0];
  const curatedExperiences = [
    featuredNightlife
      ? {
          key: `nightlife-${featuredNightlife.id}`,
          image: featuredNightlife.image,
          eyebrow: 'NIGHTLIFE',
          title: featuredNightlife.name,
          meta: `${featuredNightlife.kind} · ${featuredNightlife.hours}`,
          onPress: () => router.push(`/night/${featuredNightlife.id}`),
          onPlan: () => router.push(`/create?nightlifeId=${featuredNightlife.id}&q=${encodeURIComponent(`Dinner then drinks at ${featuredNightlife.name}`)}`),
        }
      : null,
    featuredVenue
      ? {
          key: `venue-${featuredVenue.id}`,
          image: featuredVenue.image,
          eyebrow: 'VENUE',
          title: featuredVenue.name,
          meta: featuredVenue.detailMeta,
          onPress: () => router.push(`/venue/${featuredVenue.id}`),
          onPlan: () => router.push(`/create?venueId=${featuredVenue.id}&q=${encodeURIComponent(`Dinner before a show at ${featuredVenue.name}`)}`),
        }
      : null,
    featuredCrawl
      ? {
          key: `route-${featuredCrawl.id}`,
          eyebrow: 'ROUTE',
          title: featuredCrawl.name,
          meta: featuredCrawl.meta,
          onPress: () => router.push(`/crawl/${featuredCrawl.id}`),
          onPlan: () => router.push(`/create?crawlId=${featuredCrawl.id}&q=${encodeURIComponent(`Dinner before the ${featuredCrawl.name} route`)}`),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);
  const availableCats = EVENT_CATS.filter((category) =>
    category !== 'Tonight'
      || currentEvents.some((event) => isEventToday(event)),
  );
  const activeCategory = availableCats.includes(eventCat) ? eventCat : 'Upcoming';

  const normalizedQuery = query.trim().toLowerCase();
  const showThemedSections = !normalizedQuery && activeCategory === 'Upcoming';
  const themedSections = showThemedSections ? upcomingEventSections() : [];
  const events = currentEvents.filter((event) => {
    if (activeCategory === 'Tonight') return isEventToday(event);
    if (activeCategory === 'Upcoming') return true;
    return (event.cats as string[]).includes(activeCategory);
  });

  // Cross-content search — shared with the global search overlay and the food
  // hub, scoped to what Discover itself shows (events/venues/nightlife/routes).
  // Previously typing anything here searched events only and silently hid the
  // Dining/Nightlife/Experiences tabs' own content until the query was cleared.
  const allPlaces = useAllPlaces();
  const searchIndex = useMemo(() => buildSearchIndex(allPlaces, allPicks), [allPlaces, allPicks]);
  const searchResults = useMemo(
    () => (normalizedQuery ? queryIndex(searchIndex, normalizedQuery, tasteTags).filter((r) => DISCOVER_SEARCH_KINDS.includes(r.kind)) : []),
    [searchIndex, normalizedQuery, tasteTags],
  );
  const searchGroups = useMemo(() => {
    const byKind = new Map<SearchResultKind, SearchResult[]>();
    for (const result of searchResults) {
      const bucket = byKind.get(result.kind) ?? [];
      bucket.push(result);
      byKind.set(result.kind, bucket);
    }
    return DISCOVER_SEARCH_KINDS.map((kind) => ({ kind, items: byKind.get(kind) ?? [] })).filter((group) => group.items.length > 0);
  }, [searchResults]);

  return (
    <Screen>
      <ScreenScroll gap={20} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
        <View className="mt-1 flex-row items-start justify-between gap-x-3">
          <View className="min-w-0 flex-1">
            <Text className="font-fraunces text-[26px] text-ink">Discover</Text>
            <Text className="mt-1 font-dm text-label text-taupe">Current events with direct official handoffs</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="link"
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query=things+to+do+in+Downtown+Oakland').catch(() => showToast('Could not open Maps'))}
            className="flex-row items-center gap-x-1.5 rounded-full border border-sand bg-shell px-3.5 py-2">
            <Icon d={MAP_ICON} size={13} color="#FFFFFF" strokeWidth={2} />
            <Text className="font-dm-medium text-label text-ink">Map</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-x-2.5 rounded-card border border-sand bg-shell px-4 py-2.5 shadow-2xs">
          <SearchIcon size={16} color={colors.peach} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search artists, shows, or venues"
            placeholderTextColor={colors.taupe}
            returnKeyType="search"
            className="flex-1 py-1.5 font-dm text-[14px] text-ink"
          />
          {query ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
              activeOpacity={0.7}
              onPress={() => setQuery('')}
              className="h-7 w-7 items-center justify-center rounded-full bg-sand2">
              <Text className="font-dm-bold text-[11px] text-taupe">✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!query ? (
          <HRow gap={7}>
            {CONTENT_MODES.map((mode) => (
              <Chip key={mode} label={mode} active={contentMode === mode} onPress={() => setContentMode(mode)} />
            ))}
          </HRow>
        ) : null}

        {!query && trendingEvents.length > 0 ? (
          <View className="gap-y-3">
            <View className="flex-row items-baseline justify-between gap-x-3">
              <Text className="font-fraunces text-[21px] text-ink">Trending with guests</Text>
              <Text className="font-dm-medium text-meta text-taupe">{currentEvents.length} current</Text>
            </View>
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {trendingEvents.map((event, index) => (
                <TrendingEventRow
                  key={event.id}
                  rank={index + 1}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                  onPlan={() => router.push(`/create?eventId=${event.id}&q=${encodeURIComponent(`Dinner then show ${event.name} at ${event.venue}`)}`)}
                  onBook={event.ticketed && event.ticketUrl ? () => Linking.openURL(ticketLink(event.ticketUrl!)).catch(() => showToast('Could not open that link')) : undefined}
                />
              ))}
            </RaisedView>
          </View>
        ) : !query && hydrating ? (
          <View className="gap-y-3">
            <Text className="font-fraunces text-[21px] text-ink">Trending with guests</Text>
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {[0, 1].map((i) => (
                <TrendingEventRowSkeleton key={i} rank={i + 1} />
              ))}
            </RaisedView>
          </View>
        ) : null}

        {!query && contentMode === 'Experiences' && discoverPicks.length ? (
          <View className="gap-y-3">
            <SectionHeading title="Picks for your stay" action="See all" onPress={() => router.push('/picks')} />
            <HRow gap={10}>
              {discoverPicks.map((pick) => (
                <ViatorPickCard key={pick.id} pick={pick} onPress={() => router.push(`/pick/${pick.id}`)} />
              ))}
            </HRow>
          </View>
        ) : !query && contentMode === 'Experiences' && hydrating ? (
          <View className="gap-y-3">
            <SectionHeading title="Picks for your stay" action="See all" onPress={() => router.push('/picks')} />
            <HRow gap={10}>
              {[0, 1, 2].map((i) => (
                <ViatorPickSkeleton key={i} />
              ))}
            </HRow>
          </View>
        ) : null}

        {!query && contentMode === 'Events' ? (
          <HRow gap={7}>
            {availableCats.map((label) => (
              <Chip
                key={label}
                label={label}
                active={activeCategory === label}
                onPress={() => setEventCat(label)}
              />
            ))}
          </HRow>
        ) : null}

        {query ? (
          <View className="gap-y-4">
            <Text className="font-fraunces text-[21px] text-ink">{`Results for “${query}”`}</Text>
            {searchGroups.length ? (
              searchGroups.map((group) => (
                <View key={group.kind} className="gap-y-2">
                  <Text className="font-dm-medium text-label text-taupe">{SEARCH_KIND_LABELS[group.kind]}</Text>
                  {group.kind === 'event' ? (
                    <RaisedView className="overflow-hidden rounded-card px-3.5">
                      {group.items.map((r) => {
                        const event = EVENTS[r.id];
                        return event ? (
                          <EventRow
                            key={r.id}
                            event={event}
                            onPress={() => router.push(`/event/${r.id}`)}
                            onPlan={() => router.push(`/create?eventId=${event.id}&q=${encodeURIComponent(`Dinner then show ${event.name} at ${event.venue}`)}`)}
                          />
                        ) : null;
                      })}
                    </RaisedView>
                  ) : (
                    <RaisedView className="overflow-hidden rounded-card px-3.5">
                      {group.items.map((r, index) => (
                        <TouchableOpacity
                          key={r.id}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${r.title}`}
                          activeOpacity={0.72}
                          onPress={() => router.push(r.href)}
                          className={`flex-row items-center gap-x-3 py-3 ${index < group.items.length - 1 ? 'border-b border-sand' : ''}`}>
                          <Photo uri={r.image} radius={10} style={{ width: 48, height: 48 }} />
                          <View className="min-w-0 flex-1">
                            <Text numberOfLines={1} className="font-dm-bold text-[13.5px] text-ink">{r.title}</Text>
                            <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{r.subtitle}</Text>
                          </View>
                          <ChevronRight color={colors.peach} />
                        </TouchableOpacity>
                      ))}
                    </RaisedView>
                  )}
                </View>
              ))
            ) : (
              <RaisedView className="items-center rounded-card px-4 py-6">
                <Text className="font-dm-medium text-[13.5px] text-ink">No matching current listings</Text>
                <Text className="mt-1 text-center font-dm text-label text-taupe">Try another search term, or open the food hub for restaurants and dishes.</Text>
                <View className="mt-3 flex-row gap-x-2">
                  <TouchableOpacity activeOpacity={0.72} onPress={() => setQuery('')} className="rounded-full bg-ember px-4 py-2.5">
                    <Text className="font-dm-medium text-label text-white">Clear search</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => router.push('/featured')}
                    className="rounded-full border border-sand bg-shell px-4 py-2.5">
                    <Text className="font-dm-medium text-label text-ink">Open food hub</Text>
                  </TouchableOpacity>
                </View>
              </RaisedView>
            )}
          </View>
        ) : contentMode === 'Events' && showThemedSections ? (
          <View className="gap-y-4">
            <View className="flex-row items-baseline justify-between gap-x-3">
              <Text className="font-fraunces text-[21px] text-ink">Upcoming</Text>
              <Text className="font-dm-medium text-meta text-taupe">{currentEvents.length} current</Text>
            </View>
            {themedSections.map((section) => (
              <View key={section.id} className="gap-y-2">
                <View className="flex-row items-end justify-between gap-x-3">
                  <Text className="font-fraunces text-[16px] text-ink">{section.title}</Text>
                  <Text className="pb-0.5 font-dm text-[10.5px] text-taupe">{section.note}</Text>
                </View>
                <RaisedView className="overflow-hidden rounded-card px-3.5">
                  {section.events.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      onPress={() => router.push(`/event/${event.id}`)}
                      onPlan={() => router.push(`/create?eventId=${event.id}&q=${encodeURIComponent(`Dinner then show ${event.name} at ${event.venue}`)}`)}
                    />
                  ))}
                </RaisedView>
              </View>
            ))}
          </View>
        ) : contentMode === 'Events' ? (
        <View className="gap-y-3">
          <View className="flex-row items-baseline justify-between gap-x-3">
            <Text className="font-fraunces text-[21px] text-ink">{activeCategory}</Text>
            <Text className="font-dm-medium text-meta text-taupe">{events.length} current</Text>
          </View>

          {events.length ? (
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                  onPlan={() => router.push(`/create?eventId=${event.id}&q=${encodeURIComponent(`Dinner then show ${event.name} at ${event.venue}`)}`)}
                />
              ))}
            </RaisedView>
          ) : hydrating ? (
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {[0, 1, 2].map((i) => (
                <EventRowSkeleton key={i} />
              ))}
            </RaisedView>
          ) : (
            <RaisedView className="items-center rounded-card px-4 py-6">
              <Text className="font-dm-medium text-[13.5px] text-ink">No matching current listings</Text>
              <Text className="mt-1 text-center font-dm text-label text-taupe">Try another category or search term.</Text>
              <View className="mt-3 flex-row gap-x-2">
                <TouchableOpacity
                  activeOpacity={0.72}
                  onPress={() => {
                    setQuery('');
                    setEventCat('Upcoming');
                  }}
                  className="rounded-full bg-ember px-4 py-2.5">
                  <Text className="font-dm-medium text-label text-white">Show all events</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.72}
                  onPress={() => router.push('/create')}
                  className="rounded-full border border-sand bg-shell px-4 py-2.5">
                  <Text className="font-dm-medium text-label text-ink">Plan a night instead</Text>
                </TouchableOpacity>
              </View>
            </RaisedView>
          )}
        </View>
        ) : null}

        {!query && curatedExperiences.length ? (
          <View className="gap-y-1">
            <Text className="font-fraunces text-[21px] text-ink">Featured picks</Text>
            <Text className="font-dm text-label text-taupe">One favorite from every Discover category.</Text>
            <RaisedView className="mt-2 overflow-hidden rounded-card px-3.5">
              {curatedExperiences.map((item) => (
                <CuratedRow
                  key={item.key}
                  image={item.image}
                  eyebrow={item.eyebrow}
                  title={item.title}
                  meta={item.meta}
                  onPress={item.onPress}
                  onPlan={item.onPlan}
                />
              ))}
            </RaisedView>
          </View>
        ) : null}

        {!query ? (
          <RaisedTouchable
            tone="warm"
            accessibilityRole="button"
            accessibilityLabel="Open the Oakland food hub"
            activeOpacity={0.72}
            onPress={() => router.push('/featured')}
            className="flex-row items-center gap-x-3 rounded-card px-4 py-3.5">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-coral-50">
              <Icon d={MAP_ICON} size={16} color={colors.peach} strokeWidth={1.9} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-dm-bold text-[13.5px] text-ink">Oakland food hub</Text>
              <Text className="mt-0.5 font-dm text-meta text-taupe">Restaurants, bars & venues across Oakland and the East Bay</Text>
            </View>
            <ChevronRight color={colors.peach} />
          </RaisedTouchable>
        ) : null}

        {!query ? (
          <View className="gap-y-3">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-fraunces text-[21px] text-ink">Explore venues</Text>
              <Text className="font-dm text-meta text-taupe">Official calendars</Text>
            </View>
            <HRow gap={10}>
              {Object.values(VENUES).map((venue) => (
                <PosterCard
                  key={venue.id}
                  image={venue.image}
                  eyebrow="VENUE"
                  title={venue.name}
                  meta={venue.detailMeta}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                  onPlan={() => router.push(`/create?venueId=${venue.id}&q=${encodeURIComponent(`Dinner before a show at ${venue.name}`)}`)}
                />
              ))}
            </HRow>
          </View>
        ) : null}

        {!query && contentMode === 'Nightlife' ? (
          <View className="gap-y-3">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-fraunces text-[21px] text-ink">Night out</Text>
              <Text className="font-dm text-meta text-taupe">Bars, pubs + clubs</Text>
            </View>
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {NIGHTLIFE_SPOTS.map((spot, index) => (
                <View
                  key={spot.id}
                  className={`flex-row items-center gap-x-3 py-3 ${index < NIGHTLIFE_SPOTS.length - 1 ? 'border-b border-sand' : ''}`}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`View ${spot.name}`}
                    activeOpacity={0.72}
                    onPress={() => router.push(`/night/${spot.id}`)}
                    className="min-w-0 flex-1 flex-row items-center gap-x-3">
                    <Photo uri={spot.image} radius={10} style={{ width: 44, height: 44 }} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="font-dm-bold text-[13.5px] text-ink">{spot.name}</Text>
                      <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{spot.kind}</Text>
                      <Text numberOfLines={1} className="mt-0.5 font-dm text-[10.5px] text-taupe">{spot.hours}</Text>
                    </View>
                  </TouchableOpacity>
                  <PlanChip onPress={() => router.push(`/create?nightlifeId=${spot.id}&q=${encodeURIComponent(`Dinner then drinks at ${spot.name}`)}`)} />
                  <ChevronRight color={colors.peach} />
                </View>
              ))}
            </RaisedView>
          </View>
        ) : null}

        {!query && contentMode === 'Experiences' ? (
          <View className="gap-y-3">
            <Text className="font-fraunces text-[21px] text-ink">Walkable night routes</Text>
            <HRow gap={10}>
              {Object.values(CRAWLS).map((crawl) => (
                <PosterCard
                  key={crawl.id}
                  eyebrow="ROUTE"
                  title={crawl.name}
                  meta={crawl.meta}
                  onPress={() => router.push(`/crawl/${crawl.id}`)}
                  onPlan={() => router.push(`/create?crawlId=${crawl.id}&q=${encodeURIComponent(`Dinner before the ${crawl.name} route`)}`)}
                />
              ))}
            </HRow>
          </View>
        ) : null}

        <Text className="pb-1 text-center font-dm text-[11px] leading-[16px] text-taupe">
          Dated listings expire automatically. Times and availability stay with the official venue.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}
