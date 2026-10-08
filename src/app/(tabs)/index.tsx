import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { VeeHero, HomeVeePanel, HomeHeader } from '@/components/home-top';
import { AroundYou, SubLabel, Umbrella, type CountTile } from '@/components/home-tiles';
import { Screen, ScreenScroll } from '@/components/layout';
import { ListRow } from '@/components/list-row';
import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { ChevronRight, MiniChevron, Skeleton } from '@/components/ui';
import { useContentHydrating } from '@/lib/bootstrap';
import { useNow } from '@/lib/clock';
import {
  CRAWLS,
  CURATED_COLLECTION_ORDER,
  CURATED_COLLECTIONS,
  EVENTS,
  GUEST,
  NEARBY_EATS_IDS,
  NIGHTLIFE_SPOTS,
  RESTAURANTS,
  activeCollectionItems,
  eventDayGroupLabel,
  homeEventPicks,
  isEventToday,
  type CuratedCollection,
  type Restaurant,
} from '@/lib/data';
import {
  daypartSearchPrompt,
  homeSuggestions,
  type HomeSuggestion,
} from '@/lib/daypart';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import {
  canonicalRestaurantHref,
  loadRestaurantExplorations,
  type RestaurantExploration,
} from '@/lib/exploration-history';
import { formatMiles, milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
import { openStateFor } from '@/lib/hours';
import { cityStateDisplayLabel } from '@/lib/location';
import { hydratePlacesFromBackend, useCuratedCoords, useCuratedHours } from '@/lib/places';
import { activeReminders } from '@/lib/reminders';
import { useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { collectionHaystack, eventHaystack, profileAffinity, restaurantHaystack } from '@/lib/taste';
import { useThemeColors } from '@/lib/theme';
import { useTasteProfile } from '@/lib/use-taste-profile';
import { hydrateWeatherFromBackend } from '@/lib/weather';


/** Same shape as EventRow, shown while backend events are still hydrating —
 * stands in for the row itself, never for the "no listings" empty state. */
function EventRowSkeleton() {
  return (
    <View className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <Skeleton width={58} height={58} radius={10} />
      <View className="min-w-0 flex-1 gap-y-[7px]">
        <Skeleton width="78%" height={13} radius={4} />
        <Skeleton width="58%" height={11} radius={4} />
      </View>
    </View>
  );
}

/** Names the collection's leading current item instead of a bare count, so
 * the row previews real content ("Tacos Sinaloa +2 more") rather than making
 * you tap in to find out what's actually inside. */
function CollectionRow({ collection, onPress }: { collection: CuratedCollection; onPress: () => void }) {
  const surface = useRaisedSurface(2);
  const items = activeCollectionItems(collection);
  const lead = items[0];
  const leadName = lead ? (lead.type === 'restaurant' ? RESTAURANTS[lead.id]?.name : EVENTS[lead.id]?.name) : undefined;
  const extra = items.length - (leadName ? 1 : 0);
  const tail = collection.subtitle.split(' · ').slice(-1)[0];
  const meta = leadName
    ? `${leadName}${extra > 0 ? ` +${extra} more` : ''} · ${tail}`
    : `${items.length} current ${items.length === 1 ? 'pick' : 'picks'} · ${tail}`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${collection.title}`}
      activeOpacity={0.72}
      onPress={onPress}
      style={surface}
      className="flex-row items-center gap-x-3 rounded-2xl p-3">
      <Photo uri={collection.coverImage} radius={10} style={{ width: 56, height: 56 }} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-fraunces text-[16px] text-ink">{collection.title}</Text>
        <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{meta}</Text>
      </View>
      <MiniChevron />
    </TouchableOpacity>
  );
}

function exploredRestaurantId(href: string): string | null {
  const canonical = canonicalRestaurantHref(href);
  if (!canonical) return null;
  try {
    return decodeURIComponent(canonical.slice('/restaurant/'.length));
  } catch {
    return null;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const homeColors = useThemeColors();
  const s = useScoper();
  const raisedSurface = useRaisedSurface(2);
  const hydrating = useContentHydrating();
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantExplorations, setRestaurantExplorations] = useState<RestaurantExploration[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadRestaurantExplorations().then((entries) => {
        if (active) setRestaurantExplorations(entries);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        hydrateEventsFromBackend(true),
        hydratePlacesFromBackend(true),
        hydrateWeatherFromBackend(true),
        s.refreshLocation(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  // One ticking clock drives every hour-dependent thing on this screen —
  // greeting and quick-action order — so a Home tab
  // opened at 4:59 PM isn't still calling it the afternoon at 9.
  const now = useNow();
  // Real NWS forecast for the downtown anchor, or null when no stored period
  // covers this hour — in which case the focus line just says nothing about
  // the weather rather than showing an aged one (see lib/weather.ts).
  // Full three-layer profile (stated + observed w/ decay + excluded) — every
  // ranking below uses this instead of the raw stated tags, so a ruled-out
  // tag actually demotes matches and a behavior signal counts too.
  const tasteProfile = useTasteProfile();
  // Chronological order stays the outer sort (a personalized show next month
  // must never outrank tonight's calendar) — affinity + a followed venue only
  // break ties inside "tonight" vs "later" (CLAUDE.md #4: curated, not just relevant).
  const events = useMemo(() => {
    const picks = homeEventPicks(now);
    return picks
      .map((event, index) => ({
        event,
        index,
        dayRank: isEventToday(event, now) ? 0 : 1,
        score:
          profileAffinity(eventHaystack(event), tasteProfile).score +
          (event.venueId && s.followedVenues.includes(event.venueId) ? 3 : 0),
      }))
      .sort((a, b) => a.dayRank - b.dayRank || b.score - a.score || a.index - b.index)
      .map((entry) => entry.event);
  }, [now, tasteProfile, s.followedVenues]);
  const homeCollections = useMemo(() => {
    const pool = CURATED_COLLECTION_ORDER
      .map((id) => CURATED_COLLECTIONS[id])
      .filter((collection) => activeCollectionItems(collection).length > 0);
    return pool
      .map((collection, index) => ({ collection, index, score: profileAffinity(collectionHaystack(collection), tasteProfile).score }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.collection);
  }, [tasteProfile]);
  // Walkability comes first (CLAUDE.md #2 — walkClose is the single biggest
  // affinity weight) but it's one term in the same ranker as taste, excluded
  // tags, repeat visits, budget fit, and real open-now state (CLAUDE.md #3) —
  // one score per candidate instead of a distance sort with taste as a tiebreak.
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  // Null when the device fix is missing OR too far from Downtown Oakland to
  // mean anything (see usableAnchor) — a guest browsing from home ahead of a
  // trip shouldn't see "7,500 mi" instead of the curated fallback.
  const distanceAnchor = useMemo(() => usableAnchor(s.deviceLocation), [s.deviceLocation]);
  const nearbyRestaurants = useMemo(
    () => NEARBY_EATS_IDS.map((id) => RESTAURANTS[id]).filter((restaurant): restaurant is Restaurant => Boolean(restaurant)),
    [],
  );
  const dinnerRanked = useMemo(() => {
    return nearbyRestaurants
      .map((restaurant, index) => {
        const point = curatedCoords(restaurant);
        const miles = distanceAnchor && point ? milesBetween(distanceAnchor, point) : null;
        const minutes = miles != null ? walkMinutes(miles) : null;
        const state = openStateFor(curatedHours(restaurant) ?? restaurant.hours ?? null, now);
        const { score } = profileAffinity(
          restaurantHaystack(restaurant),
          tasteProfile,
          {
            walkMinutes: minutes,
            walkBudgetMinutes: s.walkBudgetMinutes,
            budgetMatches: s.budgetPreference ? restaurant.price === s.budgetPreference : null,
            budgetLabel: restaurant.price,
            openLabel: state.status === 'open' ? (state.closesAt ? `Open till ${state.closesAt}` : 'Open now') : null,
            closedLabel: state.status === 'closed' ? (state.opensAt ? `Closed · opens ${state.opensAt}` : 'Closed now') : null,
          },
          now.getTime(),
        );
        return { restaurant, miles, state, score, index };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }, [nearbyRestaurants, curatedCoords, curatedHours, distanceAnchor, s.walkBudgetMinutes, s.budgetPreference, tasteProfile, now]);
  const dinnerPicks = useMemo(() => dinnerRanked.slice(0, 10).map((entry) => entry.restaurant), [dinnerRanked]);
  const mostExploredRestaurants = useMemo(() => {
    const nearbyIds = new Set(dinnerPicks.map((restaurant) => restaurant.id));
    const seen = new Set<string>();
    const resolved: Restaurant[] = [];

    for (const exploration of restaurantExplorations) {
      const id = exploredRestaurantId(exploration.href);
      const restaurant = id ? RESTAURANTS[id] : undefined;
      if (!restaurant || nearbyIds.has(restaurant.id) || seen.has(restaurant.id)) continue;
      seen.add(restaurant.id);
      resolved.push(restaurant);
      if (resolved.length === 4) break;
    }

    return resolved;
  }, [dinnerPicks, restaurantExplorations]);

  // "Right now" snapshot (CLAUDE.md #3): real counts off the same ranked pools
  // the sections below already use, not a separate query — mirrors the Plan
  // tab's own live-count chips so Home reads as the same concierge at a glance.
  const eventsTodayCount = useMemo(() => events.filter((event) => isEventToday(event, now)).length, [events, now]);
  const hasReminders = activeReminders(s.plans, s.stay).length > 0;
  const homeLocationLabel = cityStateDisplayLabel(s.deviceLocation, GUEST.city, 'CA');

  // Prefer a live kitchen count when structured hours are available. The
  // fallback names the ranked inventory honestly rather than calling unknown
  // hours "open". Events are dated, while bars use the verified catalog count.
  const kitchenStates = useMemo(
    () => Object.values(RESTAURANTS).map((restaurant) => openStateFor(curatedHours(restaurant) ?? restaurant.hours ?? null, now)),
    [curatedHours, now],
  );
  const hoursKnown = useMemo(() => kitchenStates.some((state) => state.status !== 'unknown'), [kitchenStates]);
  const cityOpenCount = useMemo(() => kitchenStates.filter((state) => state.status === 'open').length, [kitchenStates]);
  const openFoodHub = () => {
    s.resetFilters();
    router.push('/featured');
  };



  const suggestions = useMemo(() => homeSuggestions(now), [now]);
  const openSuggestion = (suggestion: HomeSuggestion) => {
    const query = encodeURIComponent(suggestion.query);
    router.push(suggestion.destination === 'food' ? `/featured?q=${query}` : `/discover?q=${query}`);
  };


  // The one meta line every place row carries, wherever it appears.
  const placeMeta = (restaurant: Restaurant, miles?: number | null) =>
    [restaurant.cuisine, restaurant.price, miles != null ? formatMiles(miles) : restaurant.distanceLabel]
      .filter(Boolean)
      .join(' · ');

  // ── Around you ────────────────────────────────────────────────────────────
  // Four counts off the four pools the lists below are drawn from, so the grid
  // can never disagree with them, and each tile opens the pool it counted.
  // This replaces LiveTrail, which reported the same numbers as a text line.
  const aroundYouTiles: CountTile[] = [];
  if (hoursKnown) {
    aroundYouTiles.push({
      key: 'eat', count: String(cityOpenCount), label: 'Eat', hint: 'open now',
      tint: 'accent-tint', ink: 'fg-accent', onPress: openFoodHub,
    });
  } else if (dinnerPicks.length) {
    // Hours unreadable: name the ranked inventory rather than call it open.
    aroundYouTiles.push({
      key: 'eat', count: String(dinnerPicks.length), label: 'Eat', hint: 'nearby',
      tint: 'accent-tint', ink: 'fg-accent', onPress: openFoodHub,
    });
  }
  if (eventsTodayCount > 0) {
    aroundYouTiles.push({
      key: 'shows', count: String(eventsTodayCount), label: 'Shows', hint: 'tonight',
      tint: 'vee-tint', ink: 'vee-strong', onPress: () => router.push('/discover?mode=Events'),
    });
  }
  if (NIGHTLIFE_SPOTS.length) {
    aroundYouTiles.push({
      key: 'bars', count: String(NIGHTLIFE_SPOTS.length), label: 'Bars', hint: 'in the catalog',
      tint: 'warm-tint', ink: 'warm-strong', onPress: () => router.push('/discover?mode=Nightlife'),
    });
  }
  const crawlCount = Object.keys(CRAWLS).length;
  if (crawlCount) {
    aroundYouTiles.push({
      key: 'routes', count: String(crawlCount), label: 'Routes', hint: 'multi-stop nights',
      tint: 'vee-tint', ink: 'vee-strong', onPress: () => router.push('/collection'),
    });
  }

  // ── Eat before it shuts ───────────────────────────────────────────────────
  // Ordered by how soon the kitchen closes, which is the only ordering that
  // makes the section's name true. A spot whose hours will not parse is left
  // out rather than guessed at: a wrong closing time sends someone to a locked
  // door, and CLAUDE.md #6 says we only show what the catalog can stand behind.
  const closingSoon = useMemo(() => {
    const open: { restaurant: Restaurant; closesAt: string; closesInMinutes: number }[] = [];
    for (const restaurant of Object.values(RESTAURANTS)) {
      const state = openStateFor(curatedHours(restaurant) ?? restaurant.hours ?? null, now);
      if (state.status !== 'open' || state.closesAt === null || state.closesInMinutes === null) continue;
      open.push({ restaurant, closesAt: state.closesAt, closesInMinutes: state.closesInMinutes });
    }
    return open.sort((a, b) => a.closesInMinutes - b.closesInMinutes).slice(0, 6);
  }, [curatedHours, now]);

  // Folded on arrival. The Eat tile above already states how many are open, so
  // unfolded this section opens by restating it as six rows.
  const [eatOpen, setEatOpen] = useState(false);

  const eventLead = events[0];
  const eventRest = events.slice(1, 4);

  const forYou = mostExploredRestaurants.slice(0, 3);

  return (
    <Screen>
      <ScreenScroll gap={22} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
        <HomeHeader
          locationLabel={homeLocationLabel}
          hasReminders={hasReminders}
          onNotifications={() => router.push('/notifications')}
          onProfile={() => router.push('/profile')}
        />

        {/* No hero line: the header names the city directly above this, and the
            ask bar is what the screen is for. */}
        <HomeVeePanel>
          <VeeHero
            embedded
            suggestions={suggestions}
            askPrompt={daypartSearchPrompt(now)}
            stayLabel={s.stay ? 'Update your stay' : 'Link your stay'}
            onSuggestion={openSuggestion}
            onStay={() => s.openStaySheet()}
            onAsk={() => s.openSheet('search')}
          />
        </HomeVeePanel>

        {/* The one live thing, above the groups: it belongs to no category, and
            it is the only item on Home that expires tonight. */}
        {eventLead ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${eventLead.name} at ${eventLead.venue}, ${eventDayGroupLabel(eventLead)} ${eventLead.time}`}
            activeOpacity={0.78}
            onPress={() => router.push(`/event/${eventLead.id}`)}
            style={{ backgroundColor: homeColors['vee-tint'] }}
            className="flex-row items-center gap-x-3 rounded-panel px-3.5 py-3">
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-dm-medium text-body text-ink">{eventLead.name}</Text>
              <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{eventLead.venue}</Text>
            </View>
            <Text
              style={{ color: homeColors['vee-strong'], fontVariant: ['tabular-nums'] }}
              className="shrink-0 font-dm-bold text-meta">
              {eventLead.time}
            </Text>
            <ChevronRight color={homeColors['vee-strong']} strokeWidth={1.8} />
          </TouchableOpacity>
        ) : null}

        {aroundYouTiles.length ? (
          <View className="gap-y-3">
            <Umbrella title="Around you" note="open right now" />
            <AroundYou tiles={aroundYouTiles} />
          </View>
        ) : null}

        {/* An umbrella with nothing under it is a heading for an empty room.
            Tonight has two children and either can be empty — no second show
            tonight, or no kitchen whose hours we can read — so the group only
            exists when at least one of them does. */}
        {eventRest.length || closingSoon.length || hydrating ? (
        <View className="gap-y-3">
          <Umbrella title="Tonight" note="ends when the kitchens do" />

          {eventRest.length ? (
            <View className="gap-y-1.5">
              <SubLabel title="On stage" action={`All ${events.length}`} onPress={() => router.push('/tonight')} />
              <View style={raisedSurface} className="overflow-hidden rounded-2xl">
                {eventRest.map((event, index) => (
                  <ListRow
                    key={event.id}
                    image={event.image}
                    title={event.name}
                    meta={event.venue}
                    divider={index < eventRest.length - 1}
                    trailing={
                      <Text
                        style={{ color: homeColors['vee-strong'], fontVariant: ['tabular-nums'] }}
                        className="font-dm-bold text-meta">
                        {event.time}
                      </Text>
                    }
                    onPress={() => router.push(`/event/${event.id}`)}
                  />
                ))}
              </View>
            </View>
          ) : hydrating ? (
            <View style={raisedSurface} className="overflow-hidden rounded-2xl px-3.5">
              {[0, 1, 2].map((i) => (
                <EventRowSkeleton key={i} />
              ))}
            </View>
          ) : null}

          {closingSoon.length ? (
            <View className="gap-y-1.5">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: eatOpen }}
                accessibilityLabel={`Eat before it shuts, ${closingSoon.length} places`}
                activeOpacity={0.72}
                onPress={() => setEatOpen((open) => !open)}
                className="min-h-[34px] flex-row items-center justify-between gap-x-2">
                <Text className="font-dm-bold text-micro uppercase text-taupe">Eat before it shuts</Text>
                <View className="flex-row items-center gap-x-1.5">
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="font-dm text-meta text-taupe">
                    {closingSoon.length}
                  </Text>
                  {/* The same chevron the rows use, turned to point the way
                      it will move, so the section needs no second glyph. */}
                  <View style={{ transform: [{ rotate: eatOpen ? '-90deg' : '90deg' }] }}>
                    <Glyph name="chevron" size={16} color={homeColors['fg-muted']} strokeWidth={1.8} />
                  </View>
                </View>
              </TouchableOpacity>

              {eatOpen ? (
                <View style={raisedSurface} className="overflow-hidden rounded-2xl">
                  {closingSoon.map((entry, index) => (
                    <ListRow
                      key={entry.restaurant.id}
                      image={entry.restaurant.image}
                      title={entry.restaurant.name}
                      meta={placeMeta(entry.restaurant)}
                      divider={index < closingSoon.length - 1}
                      trailing={
                        <Text
                          style={{ color: homeColors['fg-accent'], fontVariant: ['tabular-nums'] }}
                          className="font-dm-bold text-meta">
                          {entry.closesAt}
                        </Text>
                      }
                      onPress={() => router.push(`/restaurant/${entry.restaurant.id}`)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        ) : null}

        {forYou.length || homeCollections.length ? (
          <View className="gap-y-3">
            <Umbrella title="For you" note="from this trip so far" />

            {forYou.length ? (
              <View className="gap-y-1.5">
                <SubLabel title="Because of what you saved" />
                <View style={raisedSurface} className="overflow-hidden rounded-2xl">
                  {forYou.map((restaurant, index) => (
                    <ListRow
                      key={restaurant.id}
                      image={restaurant.image}
                      title={restaurant.name}
                      meta={placeMeta(restaurant)}
                      divider={index < forYou.length - 1}
                      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {homeCollections.length ? (
              <View className="gap-y-1.5">
                <SubLabel title="Collections" action="All" onPress={() => router.push('/collection')} />
                <View style={raisedSurface} className="overflow-hidden rounded-2xl">
                  {homeCollections.map((collection) => (
                    <CollectionRow
                      key={collection.id}
                      collection={collection}
                      onPress={() => router.push(`/collection/${collection.id}`)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Home used to run out of rails rather than end. Saying where the list
            stops, and when it was last checked, makes it a finite list. */}
        <Text className="pt-1 text-center font-dm text-meta text-taupe">
          That’s everything open in {homeLocationLabel.split(',')[0]} tonight.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}
