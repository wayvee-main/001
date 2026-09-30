import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { VeeHero, HomeVeePanel, HomeHeader, LiveTrail, type TrailItem } from '@/components/home-top';
import { CardCarousel } from '@/components/card-carousel';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { LeadCard, TasteMatch } from '@/components/lead-card';
import { EventMetaLine, EventPrice } from '@/components/event-meta';
import { SectionHeading } from '@/components/section-heading';
import { Photo } from '@/components/photo';
import { PosterCard } from '@/components/poster-card';
import { ChevronRight, MiniChevron, Skeleton } from '@/components/ui';
import { nearbyMetaLine, openBadgeLabel, rankNearby } from '@/lib/nearby-pool';
import { useContentHydrating } from '@/lib/bootstrap';
import { useNow } from '@/lib/clock';
import {
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
  type ScoperEvent,
} from '@/lib/data';
import {
  daypartSearchPrompt,
  homeHeroPrompt,
  homeSuggestions,
  type HomeSuggestion,
} from '@/lib/daypart';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import {
  canonicalRestaurantHref,
  loadRestaurantExplorations,
  type RestaurantExploration,
} from '@/lib/exploration-history';
import { milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
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

function EventRow({ event, matchedTag, onPress }: { event: ScoperEvent; matchedTag?: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View ${event.name}`}
      activeOpacity={0.72}
      onPress={onPress}
      className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <Photo uri={event.image} radius={10} style={{ width: 58, height: 58 }} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-x-2">
          <Text numberOfLines={1} className="flex-1 font-dm-bold text-[13.5px] text-ink">{event.name}</Text>
          <EventPrice label={event.priceLabel} />
        </View>
        <EventMetaLine when={`${eventDayGroupLabel(event)}, ${event.time}`} venue={event.venue} />
        {matchedTag ? <TasteMatch tag={matchedTag} /> : null}
      </View>
      <ChevronRight color={colors.peach} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

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
  // Home's first rail is NEARBY_EATS_IDS, which is four ids and Nearby eats
  // shows all four — so this cannot re-slice dinnerRanked without drawing the
  // same four cards again. It comes off the wider catalog instead, minus
  // whatever the two rails above already spent.
  const morePlacesNearby = useMemo(() => {
    const spent = new Set([
      ...dinnerPicks.map((restaurant) => restaurant.id),
      ...mostExploredRestaurants.map((restaurant) => restaurant.id),
    ]);
    const candidates = Object.values(RESTAURANTS)
      .filter((restaurant) => !spent.has(restaurant.id))
      .map((restaurant) => {
        const point = curatedCoords(restaurant);
        const miles = distanceAnchor && point ? milesBetween(distanceAnchor, point) : null;
        return {
          item: restaurant,
          miles,
          state: openStateFor(curatedHours(restaurant) ?? restaurant.hours ?? null, now),
        };
      });
    return rankNearby(candidates, 8);
  }, [dinnerPicks, mostExploredRestaurants, curatedCoords, curatedHours, distanceAnchor, now]);

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

  // Each count leads to the pool it counted: kitchens to the food hub, shows to
  // Tonight's events, bars to its nightlife. A number the guest cannot follow
  // is decoration, and this trail has always been the one part of Home that
  // reported real quantities without offering a way in.
  const trail = [
    hoursKnown
      ? { glyph: 'food', label: `${cityOpenCount} ${cityOpenCount === 1 ? 'kitchen' : 'kitchens'} open`, onPress: openFoodHub }
      : dinnerPicks.length
        ? { glyph: 'food', label: `${dinnerPicks.length} nearby eats`, onPress: openFoodHub }
        : null,
    eventsTodayCount > 0
      ? {
          glyph: 'ticket',
          label: `${eventsTodayCount} ${eventsTodayCount === 1 ? 'show' : 'shows'} tonight`,
          onPress: () => router.push('/discover?mode=Events'),
        }
      : null,
    NIGHTLIFE_SPOTS.length
      ? {
          glyph: 'drink',
          label: `${NIGHTLIFE_SPOTS.length} bars`,
          onPress: () => router.push('/discover?mode=Nightlife'),
        }
      : null,
  ].filter(Boolean) as TrailItem[];


  const promptContext = useMemo(
    () => ({
      now,
      tasteTags: s.tasteTags,
      tripContext: s.tripContext,
      walkBudgetMinutes: s.walkBudgetMinutes,
    }),
    [now, s.tasteTags, s.tripContext, s.walkBudgetMinutes],
  );
  const heroTitle = useMemo(() => homeHeroPrompt(promptContext), [promptContext]);
  const suggestions = useMemo(() => homeSuggestions(now), [now]);
  const openSuggestion = (suggestion: HomeSuggestion) => {
    const query = encodeURIComponent(suggestion.query);
    router.push(suggestion.destination === 'food' ? `/featured?q=${query}` : `/discover?q=${query}`);
  };

  const getEventMatchedTag = (e: ScoperEvent) =>
    s.tasteTags.find((tag) => eventHaystack(e).toLowerCase().includes(tag.toLowerCase()));

  // Both place rails are the same card in the same carousel. They were a poster
  // rail and a lead-card rail, which made two lists of restaurants read as two
  // different kinds of thing when the only real difference is how they were
  // chosen.
  const foodSection = dinnerRanked.length ? (
    <View className="gap-y-3">
      <SectionHeading title="Nearby eats" action="See all" onPress={openFoodHub} />
      <CardCarousel
        items={dinnerRanked.slice(0, 4)}
        keyExtractor={(entry) => entry.restaurant.id}
        renderItem={({ restaurant, miles }) => (
          <LeadCard
            image={restaurant.image}
            accessibilityLabel={`View ${restaurant.name}`}
            onPress={() => router.push(`/restaurant/${restaurant.id}`)}
            title={restaurant.name}
            titleTrailing={<Text className="shrink-0 font-dm-medium text-[11px] text-pine">{restaurant.price}</Text>}
            meta={nearbyMetaLine({ cuisine: restaurant.cuisine, miles, distanceLabel: restaurant.distanceLabel })}
            onPlan={() =>
              router.push(
                `/create?restaurantId=${restaurant.id}&q=${encodeURIComponent(`Night out starting at ${restaurant.name}`)}`,
              )
            }
          />
        )}
      />
    </View>
  ) : null;

  const mostExploredSection = mostExploredRestaurants.length ? (
    <View className="gap-y-3">
      <View className="flex-row items-baseline justify-between gap-x-3">
        <Text className="font-fraunces text-title text-ink">Most explored</Text>
        <Text className="font-dm text-meta text-taupe">From your searches</Text>
      </View>
      <HRow gap={10}>
        {mostExploredRestaurants.map((restaurant) => (
          <PosterCard
            key={restaurant.id}
            image={restaurant.image}
            eyebrow="RESTAURANT"
            title={restaurant.name}
            meta={[restaurant.cuisine, restaurant.price, restaurant.distanceLabel].filter(Boolean).join(' · ')}
            onPress={() => router.push(`/restaurant/${restaurant.id}`)}
            onPlan={() => router.push(`/create?restaurantId=${restaurant.id}&q=${encodeURIComponent(`Night out starting at ${restaurant.name}`)}`)}
          />
        ))}
      </HRow>
    </View>
  ) : null;


  const nearbySection = morePlacesNearby.length ? (
    <View className="gap-y-3">
      <SectionHeading title="More places nearby" action="See all" onPress={openFoodHub} />
      <CardCarousel
        items={morePlacesNearby}
        keyExtractor={(entry) => entry.item.id}
        renderItem={(entry) => {
          const badgeLabel = openBadgeLabel(entry.state);
          return (
            <LeadCard
              image={entry.item.image}
              accessibilityLabel={`View ${entry.item.name}`}
              onPress={() => router.push(`/restaurant/${entry.item.id}`)}
              // Only when the hours actually say so — a place whose hours are
              // unknown gets no badge rather than a hedged one.
              badge={
                badgeLabel ? (
                  <View className="rounded-full bg-shell/95 px-2.5 py-0.5">
                    <Text className="font-dm-bold text-[10.5px] text-ink">{badgeLabel}</Text>
                  </View>
                ) : undefined
              }
              title={entry.item.name}
              titleTrailing={<Text className="shrink-0 font-dm-medium text-[11px] text-pine">{entry.item.price}</Text>}
              meta={nearbyMetaLine({
                cuisine: entry.item.cuisine,
                miles: entry.miles,
                distanceLabel: entry.item.distanceLabel,
              })}
              onPlan={() =>
                router.push(
                  `/create?restaurantId=${entry.item.id}&q=${encodeURIComponent(`Night out starting at ${entry.item.name}`)}`,
                )
              }
            />
          );
        }}
      />
    </View>
  ) : null;

  // "Tonight" only when something really is on tonight — the picks list is
  // whatever's next on each calendar, which on a quiet Tuesday can be Friday.
  const eventLead = events[0];
  const eventRest = events.slice(1);

  const eventsSection = (
    <View className="gap-y-3">
      <View className="gap-y-1">
        <SectionHeading
          title={events.some((event) => isEventToday(event, now)) ? 'Tonight in Oakland' : 'Coming up in Oakland'}
          action="See all"
          // Pushed, not a tab switch. Three of Home's four See-alls push a
          // screen with a back button; this one moved the tab pill instead,
          // which is the whole reason it felt like it needed a transition.
          // /tonight hands off to the Discover tab from inside itself.
          onPress={() => router.push('/tonight')}
        />
      </View>
      {eventLead ? (
        <LeadCard
          image={eventLead.image}
          accessibilityLabel={`View ${eventLead.name}`}
          onPress={() => router.push(`/event/${eventLead.id}`)}
          badge={
            <View className="rounded-full bg-shell/95 px-2.5 py-0.5">
              <Text className="font-dm-bold text-[10.5px] text-ink">{eventDayGroupLabel(eventLead)} · {eventLead.time}</Text>
            </View>
          }
          title={eventLead.name}
          titleTrailing={<EventPrice label={eventLead.priceLabel} />}
          meta={<EventMetaLine venue={eventLead.venue} />}
          matchedTag={getEventMatchedTag(eventLead)}
        />
      ) : null}
      {eventRest.length ? (
        <View style={raisedSurface} className="overflow-hidden rounded-2xl px-3.5">
          {eventRest.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              matchedTag={getEventMatchedTag(event)}
              onPress={() => router.push(`/event/${event.id}`)}
            />
          ))}
        </View>
      ) : hydrating ? (
        <View style={raisedSurface} className="overflow-hidden rounded-2xl px-3.5">
          {[0, 1, 2].map((i) => (
            <EventRowSkeleton key={i} />
          ))}
        </View>
      ) : !eventLead ? (
        <View style={raisedSurface} className="rounded-2xl px-4 py-5">
          <Text className="font-dm-medium text-[13px] text-ink">No current listings are published yet.</Text>
          <Text className="mt-1 font-dm text-label text-taupe">New dated events appear here automatically — meanwhile:</Text>
          {/* Single action here — the "Plan your stay" prompt above already
              owns the /create CTA when there's no plan; a second one here
              would put the same destination on screen twice. */}
          <TouchableOpacity
            activeOpacity={0.72}
            onPress={() => router.push('/discover')}
            className="mt-3 items-center rounded-full border border-sand bg-shell py-2.5">
            <Text className="font-dm-medium text-label text-ink">Browse Discover</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <ScreenScroll gap={32} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
        <HomeHeader
          locationLabel={homeLocationLabel}
          hasReminders={hasReminders}
          onNotifications={() => router.push('/notifications')}
          onProfile={() => router.push('/profile')}
        />

        <View className="gap-y-3">
          <HomeVeePanel>
            <VeeHero
              embedded
              title={heroTitle}
              suggestions={suggestions}
              askPrompt={daypartSearchPrompt(now)}
              stayLabel={s.stay ? 'Update your stay' : 'Link your stay'}
              onSuggestion={openSuggestion}
              onStay={() => s.openStaySheet()}
              // The bar is a search bar and nothing else: it opens the search
              // overlay, which owns type-ahead, recents and its own results.
              // Vee is still reachable from in there ("Ask Vee instead") and
              // from the Plans tab — it just no longer owns Home's input.
              onAsk={() => s.openSheet('search')}
            />
          </HomeVeePanel>
        </View>

        <LiveTrail items={trail} onSeeAll={() => router.push('/around')} />

        {/* Events own the lead hierarchy at every daypart; food follows in the
            same horizontal poster language as Explore venues. */}
        {eventsSection}
        {foodSection}
        {mostExploredSection}
        {nearbySection}

        {/* "Picks for your stay" lives on Discover now — it is the only screen
            that shows the Viator roster, so it shows all of it from the top. */}

        {homeCollections.length ? (
          <View className="gap-y-3">
            <SectionHeading title="Collections" action="See all" onPress={() => router.push('/collection')} />
            <View className="gap-y-2.5">
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
      </ScreenScroll>
    </Screen>
  );
}
