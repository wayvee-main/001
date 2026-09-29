// "Build my own" — the manual pick lists and the locked/Regenerate draft
// timeline, pushed off the Plan tab's main screen (option 1a) so that screen
// can lead with the composer and ready-made cards instead. Reached either
// from the Plan tab's "Build my own" chip (starts from whatever draft already
// exists, if any) or from a ready-made card's "Use this" (which pre-seeds the
// draft before pushing here). Same real plan-engine pipeline throughout —
// every reason shown is a computed fact, never generated prose (CLAUDE.md #6).
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { ConstraintRail, literalOptions, MetaValue, useConstraintPicker } from '@/components/constraint-picker';
import { HeaderRow, HRow, Screen, ScreenScroll } from '@/components/layout';
import { addEventAction, PlanFooter, saveDinnerAction } from '@/components/plan-footer';
import { SectionHeading } from '@/components/section-heading';
import { Photo } from '@/components/photo';
import { RaisedView } from '@/components/raised-surface';
import { dinnerAction, StopRow, STOP_NOUN } from '@/components/stop-row';
import { ChevronRight, Icon } from '@/components/ui';
import {
  EVENTS,
  NIGHTLIFE_SPOTS,
  RESTAURANTS,
  currentEventListings,
  eventDayGroupLabel,
  isEventToday,
  restaurantMetaLine,
  type NightlifeSpot,
  type ScoperEvent,
} from '@/lib/data';
import { milesBetween, usableAnchor, walkMinutes, type GeoPoint } from '@/lib/geo';
import { ICON_PATHS } from '@/lib/icons';
import { EMPTY_NIGHT_DRAFT, loadItinerary, saveNightDraft, type NightDraft } from '@/lib/itinerary';
import { ticketLink } from '@/lib/links';
import { useCuratedCoords, useCuratedHours } from '@/lib/places';
import {
  computeDinnerTime,
  orderedLegs,
  planStopOrder,
  rankEvents,
  rankNightlife,
  rankRestaurants,
  solveNight,
  type StopKind,
} from '@/lib/plan-engine';
import { defaultDinnerMinutes } from '@/lib/arrival';
import { currentNightIso, isStayActive, parseDateOnly, stayNightDates, todayIso } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { spokenVibes, vibeLabel } from '@/lib/vibe-label';
import { useThemeColors } from '@/lib/theme';
import { BUDGET_OPTIONS, PACE_OPTIONS } from '@/lib/user-data';
import { useWeatherNow } from '@/lib/weather';

const VIBES = ['Foodie', 'Outdoors', 'Nightlife'];

function shortDateLabel(dateIso: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(parseDateOnly(dateIso));
}

/** First pinned item of a kind still findable in its catalog — a pin whose
 * listing rotated out (event expired, deleted) is silently skipped rather
 * than seeding a broken id. */
function firstPinned(plans: string[], kind: 'event' | 'restaurant' | 'night'): string | null {
  const prefix = `${kind}:`;
  for (const key of plans) {
    if (!key.startsWith(prefix)) continue;
    const itemId = key.slice(prefix.length);
    const exists = kind === 'event' ? Boolean(EVENTS[itemId]) : kind === 'restaurant' ? Boolean(RESTAURANTS[itemId]) : NIGHTLIFE_SPOTS.some((s) => s.id === itemId);
    if (exists) return itemId;
  }
  return null;
}

/** A draft built from what the guest already pinned from Discover for this
 * date, locked so solveNight plans around it instead of swapping it out on
 * the next Regenerate — null when nothing pinned applies to this date at all
 * (never seeds an empty-but-"generated" draft). */
function seedDraftFromPinnedPlans(plans: string[], dateIso: string): NightDraft | null {
  const dateAt = parseDateOnly(dateIso);
  dateAt.setHours(12);
  const eventId = firstPinned(plans, 'event');
  const pinnedEvent = eventId ? EVENTS[eventId] : null;
  const eventForDate = pinnedEvent && isEventToday(pinnedEvent, dateAt) ? eventId : null;
  const restaurantId = firstPinned(plans, 'restaurant');
  const nightlifeSpotId = firstPinned(plans, 'night');

  if (!eventForDate && !restaurantId && !nightlifeSpotId) return null;
  return {
    generated: false,
    eventId: eventForDate,
    restaurantId,
    nightlifeSpotId,
    lockedEvent: Boolean(eventForDate),
    lockedRestaurant: Boolean(restaurantId),
    lockedNightlife: Boolean(nightlifeSpotId),
  };
}

export default function PlanDraftScreen() {
  const router = useRouter();
  const {
    budgetPreference,
    deviceLocation,
    isPlanned,
    isSaved,
    pacePreference,
    plans,
    setBudgetPreference,
    askPlan,
    setPacePreference,
    showToast,
    stay,
    tasteTags,
    togglePlan,
    tripContext,
    toggleSaved,
  } = useScoper();
  const colors = useThemeColors();
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const weatherNow = useWeatherNow();
  const [vibes, setVibes] = useState<string[]>([]);
  const { open: picker, toggle: togglePicker, close: closePicker, motion: pickerMotion } =
    useConstraintPicker<'pace' | 'budget' | 'vibe'>();
  const pace = pacePreference ?? 'Relaxed';
  const budget = budgetPreference ?? '$$';

  // Anchored to a place (CLAUDE.md #1): the stay itself is free-text (no brand
  // database to geocode against), so the guest's live device fix anchors
  // "walkability first" here too — but only within the service area; a fix
  // from outside Downtown Oakland is noise, not a signal (see usableAnchor).
  const anchor: GeoPoint | null = usableAnchor(deviceLocation);

  const stayActive = Boolean(stay && isStayActive(stay));
  const nightDates = useMemo(() => (stayActive ? stayNightDates(stay!) : [todayIso()]), [stayActive, stay]);
  // Shared with the Plans tab and /plan, so all three agree on which night a
  // draft belongs to — /plan writes the draft this screen then opens.
  const defaultDateIndex = useMemo(() => {
    const index = nightDates.indexOf(currentNightIso(stay ?? null));
    return index >= 0 ? index : 0;
  }, [nightDates, stay]);

  const stayKey = stay ? `${stay.propertyName}|${stay.checkIn}|${stay.checkOut}` : 'none';
  const [selectedDateIndex, setSelectedDateIndex] = useState(defaultDateIndex);
  const [selectedDateStayKey, setSelectedDateStayKey] = useState(stayKey);
  if (stayKey !== selectedDateStayKey) {
    setSelectedDateStayKey(stayKey);
    setSelectedDateIndex(defaultDateIndex);
  }
  const selectedDate = nightDates[selectedDateIndex] ?? nightDates[0];

  const [drafts, setDrafts] = useState<Record<string, NightDraft>>({});
  useEffect(() => {
    loadItinerary(stay ?? null).then((nights) => {
      // A first-ever visit to this date has no draft yet — before falling
      // back to EMPTY_NIGHT_DRAFT, check whether the guest already pinned
      // something for tonight from Discover (event/restaurant/nightlife).
      // Locked so the engine plans *around* their own choice rather than
      // silently swapping it out on the next Regenerate. Only fires once:
      // once a draft exists for a date (seeded or hand-built), it's never
      // overwritten by a plan pinned afterward.
      if (!nights[selectedDate]) {
        const seeded = seedDraftFromPinnedPlans(plans, selectedDate);
        if (seeded) {
          nights = { ...nights, [selectedDate]: seeded };
          void saveNightDraft(stay ?? null, selectedDate, seeded);
        }
      }
      setDrafts(nights);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay?.propertyName, stay?.checkIn, stay?.checkOut, selectedDate, plans]);
  const draft = drafts[selectedDate] ?? EMPTY_NIGHT_DRAFT;

  const updateDraft = (patch: Partial<NightDraft>) => {
    setDrafts((prev) => {
      const next = { ...(prev[selectedDate] ?? EMPTY_NIGHT_DRAFT), ...patch };
      void saveNightDraft(stay ?? null, selectedDate, next);
      return { ...prev, [selectedDate]: next };
    });
  };

  const toggleVibe = (vibe: string) => setVibes((current) => (current.includes(vibe) ? current.filter((v) => v !== vibe) : [...current, vibe]));

  const vibesKey = vibes.join(',');
  const tasteKey = tasteTags.join(',');

  const selectedDateAt = useMemo(() => {
    const at = parseDateOnly(selectedDate);
    at.setHours(12);
    return at;
  }, [selectedDate]);

  const rankedEventsAll = useMemo(() => {
    const onThisDate = currentEventListings(selectedDateAt).filter((e) => isEventToday(e, selectedDateAt));
    let pool = onThisDate;
    if (vibes.includes('Outdoors')) {
      const outdoor = onThisDate.filter((e) => (e.cats as string[]).includes('Outdoor'));
      if (outdoor.length) pool = outdoor;
    }
    if (vibes.includes('Nightlife')) {
      const nightlife = onThisDate.filter((e) => (e.cats as string[]).includes('Live music'));
      if (nightlife.length) pool = nightlife;
    }
    return rankEvents(pool, { tasteTags, vibes, weather: weatherNow, tripContext });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateAt, vibesKey, tasteKey, weatherNow, tripContext]);
  const eventsForSelectedDate = useMemo(() => rankedEventsAll.slice(0, 6).map((pick) => pick.item), [rankedEventsAll]);

  /** The soonest listing after this date. An empty "what's on" should say when
   * Oakland's next night actually is — "no current events are available" reads
   * as an empty catalog while Discover is simultaneously showing fourteen. */
  const nextListing = useMemo(() => {
    return currentEventListings(selectedDateAt)
      .filter((e) => e.startsAt && !isEventToday(e, selectedDateAt))
      .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))[0] ?? null;
  }, [selectedDateAt]);

  const event: ScoperEvent | undefined = EVENTS[draft.eventId ?? ''] ?? eventsForSelectedDate[0];
  // The arrival sequence promised dinner defaults earlier for a visitor or a
  // work trip; with no show to sit before, this is where that lands.
  const dinnerDefault = defaultDinnerMinutes(tripContext);
  const dinnerAt = useMemo(
    () => computeDinnerTime(event ?? null, selectedDateAt, null, dinnerDefault),
    [event, selectedDateAt, dinnerDefault],
  );

  const recentRestaurantIds = useMemo(() => {
    return nightDates
      .map((date, index) => ({ date, index }))
      .filter(({ date }) => date !== selectedDate)
      .sort((a, b) => Math.abs(a.index - selectedDateIndex) - Math.abs(b.index - selectedDateIndex))
      .map(({ date }) => drafts[date]?.restaurantId)
      .filter((id): id is string => Boolean(id));
  }, [nightDates, selectedDate, selectedDateIndex, drafts]);
  const recentRestaurantKey = recentRestaurantIds.join(',');

  const rankedRestaurantsAll = useMemo(
    () =>
      rankRestaurants(Object.values(RESTAURANTS), {
        budget,
        tasteTags,
        vibes,
        anchor,
        coordsOf: curatedCoords,
        hoursOf: curatedHours,
        dinnerAt,
        recentRestaurantIds,
        savedPlaceKeys: [],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budget, vibesKey, tasteKey, anchor, curatedCoords, curatedHours, dinnerAt, recentRestaurantKey],
  );
  const restaurants = useMemo(() => rankedRestaurantsAll.slice(0, 8).map((pick) => pick.item), [rankedRestaurantsAll]);
  const restaurant = RESTAURANTS[draft.restaurantId ?? ''] ?? restaurants[0];

  const rankedNightlifeAll = useMemo(
    () => (pace === 'Packed' ? rankNightlife(NIGHTLIFE_SPOTS, { tasteTags, anchor, coordsOf: curatedCoords }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pace, tasteKey, anchor, curatedCoords],
  );
  const nightlifeCandidates = useMemo(() => rankedNightlifeAll.map((pick) => pick.item), [rankedNightlifeAll]);
  const nightlifeSpot: NightlifeSpot | undefined =
    pace === 'Packed' ? NIGHTLIFE_SPOTS.find((spot) => spot.id === draft.nightlifeSpotId) ?? nightlifeCandidates[0] : undefined;

  const restaurantReasons = restaurant ? rankedRestaurantsAll.find((pick) => pick.item.id === restaurant.id)?.reasons ?? [] : [];
  const eventReasons = event ? rankedEventsAll.find((pick) => pick.item.id === event.id)?.reasons ?? [] : [];
  const nightlifeReasons = nightlifeSpot ? rankedNightlifeAll.find((pick) => pick.item.id === nightlifeSpot.id)?.reasons ?? [] : [];

  const solve = (locked: { restaurantId?: string | null; eventId?: string | null; nightlifeId?: string | null }, avoid?: typeof locked) =>
    solveNight({
      restaurants: rankedRestaurantsAll,
      events: rankedEventsAll,
      nightlife: pace === 'Packed' ? rankedNightlifeAll : null,
      coordsOfRestaurant: curatedCoords,
      coordsOfEvent: (e) => curatedCoords({ name: e.venue }),
      coordsOfNightlife: curatedCoords,
      pace,
      locked,
      avoid,
    });

  const generateNight = () => {
    const solved = solve({});
    updateDraft({
      generated: true,
      restaurantId: solved.restaurant?.id ?? null,
      eventId: solved.event?.id ?? null,
      nightlifeSpotId: solved.nightlifeSpot?.id ?? null,
      lockedRestaurant: false,
      lockedEvent: false,
      lockedNightlife: false,
    });
  };

  const regenerate = () => {
    const solved = solve(
      {
        restaurantId: draft.lockedRestaurant ? draft.restaurantId : null,
        eventId: draft.lockedEvent ? draft.eventId : null,
        nightlifeId: draft.lockedNightlife ? draft.nightlifeSpotId : null,
      },
      { restaurantId: draft.restaurantId, eventId: draft.eventId, nightlifeId: draft.nightlifeSpotId },
    );
    updateDraft({
      restaurantId: solved.restaurant?.id ?? null,
      eventId: solved.event?.id ?? null,
      nightlifeSpotId: solved.nightlifeSpot?.id ?? null,
    });
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => showToast('Could not open that link'));

  const { order: stopOrder, dinnerTimeLabel } = planStopOrder(event ?? null, restaurant ?? null, nightlifeSpot ?? null, selectedDateAt, dinnerDefault);
  const pointForStop = (kind: StopKind): GeoPoint | null => {
    if (kind === 'event') return event ? curatedCoords({ name: event.venue }) : null;
    if (kind === 'dinner') return restaurant ? curatedCoords(restaurant) : null;
    return nightlifeSpot ? curatedCoords(nightlifeSpot) : null;
  };
  const stopLegs = orderedLegs(stopOrder, pointForStop);

  const distanceBasis = anchor ? 'Ranked by distance from you, taste, and what’s actually open.' : null;

  const nightHint =
    stayActive && nightDates.length > 1
      ? selectedDateIndex === 0
        ? 'Arrival night — kept close to home base.'
        : selectedDateIndex === nightDates.length - 1
          ? 'Last night — an easy one before checkout.'
          : null
      : null;

  return (
    <Screen>
      <ScreenScroll gap={22}>
        {/* One header definition, shared with /plan and every See-all. The
            edit tile that sat between the back button and the title is gone:
            a screen reached by tapping "Build my own" or "Refine" does not
            need a second icon telling it that it edits something. */}
        <HeaderRow
          title={draft.source === 'vee' ? 'Your night' : 'Build your night'}
          subtitle={
            draft.source === 'vee' ? (
              // Two doors reach this screen. Someone who tapped "Use this plan"
              // on a ready-made shape did the opposite of picking every stop
              // themselves, so they get their own greeting and the shape they
              // chose.
              <View className="flex-row items-center gap-x-1.5">
                <View style={{ backgroundColor: colors['vee-tint'] }} className="rounded px-1.5 py-0.5">
                  <Text style={{ color: colors['vee-strong'] }} className="font-dm-bold text-micro uppercase">
                    Vee&rsquo;s pick
                  </Text>
                </View>
                <Text numberOfLines={1} className="min-w-0 flex-1 font-dm text-meta text-taupe">
                  {draft.themeName ? `${draft.themeName} · swap anything` : 'Swap anything'}
                </Text>
              </View>
            ) : (
              <Text numberOfLines={1} className="font-dm text-meta text-taupe">Pick every stop yourself</Text>
            )
          }
          trailing={
            /* Only when there is a plan to go back to. This screen is the edit
               state of /plan now, and an edit state with no way back but
               Discover is a dead end — but it is still reachable on its own,
               and then there is nothing behind it to return to. */
            askPlan ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Done editing, back to the plan"
                activeOpacity={0.75}
                // back(), not push(): Refine pushed this screen on top of
                // /plan, so pushing a second /plan would leave create → plan →
                // draft → plan on the stack and a back tap would land on the
                // builder again instead of the composer.
                onPress={() => (router.canGoBack() ? router.back() : router.push('/plan'))}
                className="h-9 items-center justify-center rounded-full border border-sand bg-shell px-3.5">
                <Text className="font-dm-medium text-label text-peach">Done</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {stayActive && nightDates.length > 1 ? (
          <HRow gap={8}>
            {nightDates.map((date, index) => {
              const active = index === selectedDateIndex;
              const hasDraft = drafts[date]?.generated;
              return (
                <TouchableOpacity
                  key={date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.72}
                  onPress={() => setSelectedDateIndex(index)}
                  className={`items-center rounded-control border px-3.5 py-2 ${active ? 'border-rust bg-coral-50' : 'border-sand bg-shell'}`}>
                  <Text className={`font-dm-bold text-label ${active ? 'text-coralDark' : 'text-ink'}`}>
                    Night {index + 1}
                    {hasDraft ? ' ·' : ''}
                  </Text>
                  <Text className="mt-0.5 font-dm text-meta text-taupe">{shortDateLabel(date)}</Text>
                </TouchableOpacity>
              );
            })}
          </HRow>
        ) : null}
        {nightHint ? <Text className="-mt-2.5 font-dm text-meta text-taupe">{nightHint}</Text> : null}

        {/* Three values, three pills — the row the composer wears one screen
            back (constraint-picker.tsx). It replaced a heading, three vibe
            chips and a two-column Pace/Budget grid: 137 pt of controls sitting
            above the draft they change, in the only idiom left on the screen
            that nothing else in the app still uses. The pill says the current
            value, so nothing is hidden by making it small. */}
        <View className="gap-y-2">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <MetaValue constraint="pace" glyph="walk" label={pace} onPress={() => togglePicker('pace')} />
            <MetaValue constraint="budget" glyph="wallet" label={budget} onPress={() => togglePicker('budget')} />
            <MetaValue
              constraint="vibe"
              glyph="spark"
              label={vibeLabel(vibes)}
              spokenLabel={spokenVibes(vibes)}
              onPress={() => togglePicker('vibe')}
            />
          </View>
          {picker ? (
            <ConstraintRail
              motion={pickerMotion}
              // Pace and budget are one value each, so choosing closes the
              // rail. Vibe is a set — closing after the first tap would make a
              // second choice cost a second trip through the pill.
              onChoose={picker === 'vibe' ? () => undefined : closePicker}
              options={
                picker === 'pace'
                  ? literalOptions(PACE_OPTIONS, pace, setPacePreference)
                  : picker === 'budget'
                    ? literalOptions(BUDGET_OPTIONS, budget, setBudgetPreference)
                    : VIBES.map((vibe) => ({
                        key: vibe,
                        label: vibe,
                        selected: vibes.includes(vibe),
                        onSelect: () => toggleVibe(vibe),
                      }))
              }
            />
          ) : null}
        </View>


        {eventsForSelectedDate.length === 0 && restaurants.length === 0 ? (
          <RaisedView className="rounded-2xl px-4 py-5">
            <Text className="font-dm-medium text-label text-ink">Nothing matches that combination yet.</Text>
            <Text className="mt-1 font-dm text-label text-taupe">Try a different vibe or budget.</Text>
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => router.push('/discover')}
              className="mt-3 items-center self-start rounded-full border border-sand bg-shell px-4 py-2.5">
              <Text className="font-dm-medium text-label text-ink">Browse Discover</Text>
            </TouchableOpacity>
          </RaisedView>
        ) : !draft.generated ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={generateNight}
            className="flex-row items-center justify-center gap-x-2 rounded-full bg-rust py-[15px] shadow-sm">
            <Icon d={ICON_PATHS.sparkles} size={15} color="#FFFFFF" strokeWidth={2} />
            <Text className="font-dm-bold text-body-strong text-white">Generate itinerary</Text>
          </TouchableOpacity>
        ) : null}

        {draft.generated && (restaurant || event) ? (
          <View className="gap-y-3">
            {/* One heading, one action. Regenerate and Start over sat side by
                side here as two competing right-hand buttons; SectionHeading
                takes the one that belongs to the heading, and Start over drops
                to the hint line below, next to the sentence that explains what
                Regenerate does. */}
            <SectionHeading title="Your draft" action="Regenerate" onPress={regenerate} />

            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {stopOrder.map((kind, index) => {
                const last = index === stopOrder.length - 1;
                // The walk belongs to the stop it leads to — see plan.tsx.
                const arriving = index > 0 ? stopLegs[index - 1] : null;
                const legLabel = arriving ? `${arriving} from ${STOP_NOUN[stopOrder[index - 1]]}` : null;
                if (kind === 'event' && event) {
                  return (
                    <StopRow
                      key="event"
                      kind="event"
                      time={`${eventDayGroupLabel(event)} · ${event.time}`}
                      title={event.name}
                      subtitle={event.venue}
                      reasonLabel={eventReasons.slice(0, 2).join(' · ') || null}
                      actionLabel={event.ticketed && event.ticketUrl ? 'Book' : undefined}
                      onAction={event.ticketed && event.ticketUrl ? () => openLink(ticketLink(event.ticketUrl!)) : undefined}
                      locked={draft.lockedEvent}
                      onToggleLock={() => updateDraft({ lockedEvent: !draft.lockedEvent })}
                      legLabel={legLabel}
                      last={last}
                    />
                  );
                }
                if (kind === 'dinner' && restaurant) {
                  return (
                    <StopRow
                      key="dinner"
                      kind="dinner"
                      time={`Dinner · ${dinnerTimeLabel}`}
                      title={restaurant.name}
                      subtitle={restaurantMetaLine(restaurant)}
                      reasonLabel={restaurantReasons.slice(0, 2).join(' · ') || null}
                      actionLabel={dinnerAction(restaurant).label}
                      onAction={() => openLink(dinnerAction(restaurant).url)}
                      locked={draft.lockedRestaurant}
                      onToggleLock={() => updateDraft({ lockedRestaurant: !draft.lockedRestaurant })}
                      legLabel={legLabel}
                      last={last}
                    />
                  );
                }
                if (kind === 'nightlife' && nightlifeSpot) {
                  return (
                    <StopRow
                      key="nightlife"
                      kind="nightlife"
                      time="Nightcap"
                      title={nightlifeSpot.name}
                      subtitle={`${nightlifeSpot.kind} · ${nightlifeSpot.hours}`}
                      reasonLabel={nightlifeReasons.slice(0, 2).join(' · ') || null}
                      onPress={() => router.push(`/night/${nightlifeSpot.id}`)}
                      locked={draft.lockedNightlife}
                      onToggleLock={() => updateDraft({ lockedNightlife: !draft.lockedNightlife })}
                      legLabel={legLabel}
                      last={last}
                    />
                  );
                }
                return null;
              })}
            </RaisedView>
            <View className="flex-row items-center justify-center gap-x-2">
              <Text className="font-dm text-meta text-taupe">Lock a stop to protect it, then Regenerate swaps the rest.</Text>
              <TouchableOpacity accessibilityRole="button" activeOpacity={0.72} onPress={generateNight} hitSlop={6}>
                <Text className="font-dm-medium text-meta text-peach">Start over</Text>
              </TouchableOpacity>
            </View>

            {/* Same row as /plan's, same component: the last target is the
                commitment and nothing stretches alone. */}
            <PlanFooter
              actions={[
                restaurant
                  ? saveDinnerAction(isSaved('restaurant', restaurant.id), () =>
                      toggleSaved('restaurant', restaurant.id, restaurant.name))
                  : null,
                event ? addEventAction(isPlanned('event', event.id), () => togglePlan('event', event.id, event.name)) : null,
              ].filter((action) => action !== null)}
            />
          </View>
        ) : null}

        <View className="gap-y-3">
          <SectionHeading title="Pick dinner yourself" action="All food" onPress={() => router.push('/featured')} />
          {distanceBasis ? <Text className="-mt-1 font-dm text-meta text-taupe">{distanceBasis}</Text> : null}
          <RaisedView className="overflow-hidden rounded-2xl px-3.5">
            {restaurants.map((option, index) => {
              const selected = option.id === (draft.restaurantId ?? restaurants[0]?.id);
              const saved = isSaved('restaurant', option.id);
              const point = curatedCoords(option);
              const miles = anchor && point ? milesBetween(anchor, point) : null;
              // One unit down one column (DESIGN.md's signature slot). Computed
              // walk minutes when we can measure them; the curated label only as
              // a fallback, so the column stays comparable row to row instead of
              // mixing miles, walk minutes and ride times.
              const walkMin = miles != null ? walkMinutes(miles) : null;
              return (
                <TouchableOpacity
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  activeOpacity={0.72}
                  onPress={() => updateDraft({ restaurantId: option.id })}
                  className={`flex-row items-center gap-x-3 py-3 ${index < restaurants.length - 1 ? 'border-b border-sand' : ''}`}>
                  <Photo uri={option.image} radius={10} style={{ width: 40, height: 40 }} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className={`font-dm-bold text-body ${selected ? 'text-rust' : 'text-ink'}`}>
                      {option.name}
                      {saved ? '  ♥' : ''}
                    </Text>
                    <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                      {[option.cuisine, option.price].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text
                    style={{ fontVariant: ['tabular-nums'] }}
                    className={`shrink-0 font-dm-bold text-meta ${walkMin != null && walkMin <= 5 ? 'text-pine' : 'text-taupe'}`}>
                    {walkMin != null ? `${walkMin} min` : option.distanceLabel}
                  </Text>
                  <View className={`h-4 w-4 rounded-full border ${selected ? 'border-rust bg-ember' : 'border-sand bg-shell'}`} />
                </TouchableOpacity>
              );
            })}
          </RaisedView>
        </View>

        <View className="gap-y-3">
          <SectionHeading title="Pick what's on yourself" action="All events" onPress={() => router.push('/discover')} />
          {eventsForSelectedDate.length ? (
            <RaisedView className="overflow-hidden rounded-2xl px-3.5">
              {eventsForSelectedDate.map((option, index) => {
                const selected = option.id === (draft.eventId ?? eventsForSelectedDate[0]?.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    activeOpacity={0.72}
                    onPress={() => updateDraft({ eventId: option.id })}
                    className={`flex-row items-center gap-x-3 py-3 ${index < eventsForSelectedDate.length - 1 ? 'border-b border-sand' : ''}`}>
                    <Photo uri={option.image} radius={10} style={{ width: 40, height: 40 }} />
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className={`font-dm-bold text-body ${selected ? 'text-rust' : 'text-ink'}`}>{option.name}</Text>
                      <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                        {eventDayGroupLabel(option)} · {option.time} · {option.venue}
                      </Text>
                    </View>
                    <View className={`h-4 w-4 rounded-full border ${selected ? 'border-rust bg-ember' : 'border-sand bg-shell'}`} />
                  </TouchableOpacity>
                );
              })}
            </RaisedView>
          ) : (
            <RaisedView className="rounded-2xl px-4 py-5">
              <Text className="font-dm-medium text-label text-ink">
                {stayActive ? 'No listed events land on this night.' : 'Nothing listed for tonight.'}
              </Text>
              <Text className="mt-1 font-dm text-label text-taupe">
                {nextListing ? 'Oakland’s next listed night is below.' : 'New dated listings will appear here automatically.'}
              </Text>
              {nextListing ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${nextListing.name}, ${eventDayGroupLabel(nextListing, selectedDateAt)}`}
                  activeOpacity={0.72}
                  onPress={() => router.push(`/event/${nextListing.id}`)}
                  className="mt-3 flex-row items-center gap-x-2 rounded-xl border border-sand bg-cream px-3 py-2.5">
                  <Text style={{ color: colors['vee-strong'] }} className="shrink-0 font-dm-bold text-micro uppercase">
                    {eventDayGroupLabel(nextListing, selectedDateAt)} · {nextListing.time}
                  </Text>
                  <Text numberOfLines={1} className="min-w-0 flex-1 font-dm-medium text-label text-ink">{nextListing.name}</Text>
                  <ChevronRight />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.72}
                onPress={() => router.push('/discover')}
                className="mt-3 items-center self-start rounded-full border border-sand bg-shell px-4 py-2.5">
                <Text className="font-dm-medium text-label text-ink">Browse Discover</Text>
              </TouchableOpacity>
            </RaisedView>
          )}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
