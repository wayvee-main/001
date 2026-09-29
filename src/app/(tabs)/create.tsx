// Plan tab. The guest asks Vee for a night in natural language, or accepts one
// of the ready-made nights the plan engine already assembled from real, open,
// walkable options. Every fact shown is a value solveNight() computed — never
// generated prose (CLAUDE.md #6).
//
// The landing leads with the ask box, whose example line is a *label* rather
// than prefilled text: it shows what a good ask sounds like without putting
// words in the guest's mouth. Vee's assumptions sit under it as one line of
// type — start time, budget, walk budget — each value tappable through to its
// own rail. Below that, one example per intent the router actually resolves,
// then every shape the engine returned as a picker rather than one card and a
// reroll: they are all solved on every render, and three comparable options
// read as a choice where one reads as a verdict.
//
// The manual pick lists and the locked/Regenerate draft timeline live one tap
// away at /plan-draft; this screen only leads with them.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ConstraintRail, MetaValue, useConstraintPicker } from '@/components/constraint-picker';
import { Glyph } from '@/components/glyph';
import { HomeHeader } from '@/components/home-top';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { buildPlan, mergeRefineRequest, resolveAskNow } from '@/lib/concierge/adapter';
import { requestConciergeRequest } from '@/lib/concierge/client';
import { BUDGET_OPTIONS } from '@/lib/concierge/enums';
import { applyFreshness, readSyncStatus } from '@/lib/concierge/freshness';
import { routeForRequest } from '@/lib/concierge/router';
import { CRAWLS, GUEST, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES, currentEventListings, isEventToday, type ScoperEvent } from '@/lib/data';
import { loadDinnerHistory } from '@/lib/dinner-history';
import type { GeoPoint } from '@/lib/geo';
import { saveNightDraft } from '@/lib/itinerary';
import { defaultDinnerMinutes } from '@/lib/arrival';
import { cityStateDisplayLabel } from '@/lib/location';
import { useReducedMotionPreference } from '@/lib/motion';
import { START_TIME_OPTIONS } from '@/lib/plan-constraints';
import { useRaisedSurface } from '@/lib/shadows';
import { useAllPlaces, useCuratedCoords, useCuratedHours } from '@/lib/places';
import { activeReminders } from '@/lib/reminders';
import { recordRecentAsk } from '@/lib/recent-asks';
import { buildSearchIndex, queryIndex, type SearchResultKind } from '@/lib/search';
import {
  computeDinnerTime,
  microDistrictOf,
  orderedLegs,
  planStopOrder,
  rankEvents,
  rankNightlife,
  rankRestaurants,
  solveNight,
  type SolvedNight,
  type StopKind,
} from '@/lib/plan-engine';
import { planFromShape } from '@/lib/plan-from-shape';
import { currentNightIso, isStayActive, parseDateOnly, stayArcPosition, stayProgress } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { tasteVocabulary } from '@/lib/taste';
import { useThemeColors } from '@/lib/theme';
import { useViatorPicks } from '@/lib/viator';
import { useWeatherNow, weatherLine } from '@/lib/weather';

/** How many distinct sets of shapes the regenerate button cycles through before
 * it comes back to the first. Three is the cycle length, not a claim that only
 * three nights exist — the counter next to the button reads position in it. */
const PLAN_SETS = 3;

type ComposerPicker = 'time' | 'budget' | 'walk' | null;

const WALK_BUDGET_OPTIONS = [10, 20, null] as const;

const SEARCH_RESULT_GLYPHS: Record<SearchResultKind, string> = {
  restaurant: 'food',
  dish: 'food',
  place: 'pin',
  event: 'ticket',
  venue: 'pin',
  night: 'drink',
  crawl: 'walk',
  pick: 'compass',
  collection: 'heart',
};

const SEARCH_RESULT_FAMILIES: Record<SearchResultKind, string> = {
  restaurant: 'place',
  dish: 'dish',
  place: 'place',
  event: 'show',
  venue: 'venue',
  night: 'nightlife',
  crawl: 'route',
  pick: 'experience',
  collection: 'collection',
};

const SEARCH_RESULT_LABELS: Record<SearchResultKind, string> = {
  restaurant: 'Place',
  dish: 'Dish',
  place: 'Place',
  event: 'Show',
  venue: 'Venue',
  night: 'Nightlife',
  crawl: 'Route',
  pick: 'Experience',
  collection: 'Collection',
};

const NEARBY_RESULT_KINDS = new Set<SearchResultKind>(['restaurant', 'place', 'venue', 'night']);

/** The local picker uses friendly 12-hour labels, while concierge requests
 * deliberately accept only validated 24-hour clock values. */
function to24Hour(label: string | null): string | null {
  if (!label) return null;
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const normalizedHour = (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Applies a "H:MM AM/PM" wall-clock label onto the given date's day —
 * combines the guest's own "Start" constraint with tonight's real calendar
 * date, the same way computeDinnerTime anchors its own 7 PM fallback. */
function applyTimeOfDay(base: Date, label: string): Date | null {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  const at = new Date(base);
  at.setHours(hour, Number(match[2]), 0, 0);
  return at;
}

function sameSolve(a: SolvedNight, b: SolvedNight): boolean {
  return a.restaurant?.id === b.restaurant?.id && a.event?.id === b.event?.id && a.nightlifeSpot?.id === b.nightlifeSpot?.id;
}

/** Sum of known walk legs between a card's stops. Null (not 0) when any leg's
 * coordinates are unknown — an honest "not listed" beats a total that quietly
 * undercounts (CLAUDE.md: no invented data). */
function totalWalkMinutes(legs: (string | null)[]): number | null {
  if (!legs.length) return 0;
  const minutes = legs.map((leg) => (leg ? Number.parseInt(leg, 10) : NaN));
  if (minutes.some((value) => Number.isNaN(value))) return null;
  return minutes.reduce((sum, value) => sum + value, 0);
}

/** Stop count and walk total for a solve — the two facts every shape is
 * described by, whether it is drawn as a full card or as one row in the picker.
 * Shared so a tile and its card can never disagree about the same night. */
function useShapeFacts(solved: SolvedNight, selectedDateAt: Date) {
  const curatedCoords = useCuratedCoords();
  // Read here rather than threaded through every tile: a shape's dinner time
  // has to agree with the composer's, and both answer to the same promise.
  const tripContext = useScoper((state) => state.tripContext);
  const { order, dinnerTimeLabel } = planStopOrder(
    solved.event,
    solved.restaurant,
    solved.nightlifeSpot,
    selectedDateAt,
    defaultDinnerMinutes(tripContext),
  );
  const pointForStop = (kind: StopKind): GeoPoint | null => {
    if (kind === 'event') return solved.event ? curatedCoords({ name: solved.event.venue }) : null;
    if (kind === 'dinner') return solved.restaurant ? curatedCoords(solved.restaurant) : null;
    return solved.nightlifeSpot ? curatedCoords(solved.nightlifeSpot) : null;
  };
  const total = totalWalkMinutes(orderedLegs(order, pointForStop));
  // No computed walk total (a leg's coordinates are unknown) but the event's
  // own curated travel note already says "ride" — a real sourced fact beats
  // silence, so it stands in for the total rather than "not listed".
  const fallbackTravel = total === null && solved.event?.travel && /ride/i.test(solved.event.travel) ? solved.event.travel : null;
  const walkLabel = total !== null ? (total === 0 ? 'no walking' : `${total} min walk`) : fallbackTravel ?? 'walk time not listed';
  const stopCount = order.filter((kind) =>
    kind === 'event' ? Boolean(solved.event) : kind === 'dinner' ? Boolean(solved.restaurant) : Boolean(solved.nightlifeSpot),
  ).length;
  return { order, dinnerTimeLabel, walkLabel, stopCount, walkMinutes: total };
}

/** The night as its actual stops, in the order they happen: "The Cook and Her
 * Farmer → Hello Stranger". Replaces a subtitle that printed the same stop
 * count and the same walk label on every row — three identical lines are not a
 * choice, and a route is the one thing about a shape worth wanting. */
function shapeRoute(solved: SolvedNight, order: StopKind[]): string {
  return order
    .map((kind) =>
      kind === 'dinner' ? solved.restaurant?.name : kind === 'event' ? solved.event?.venue : solved.nightlifeSpot?.name,
    )
    .filter((name): name is string => Boolean(name))
    .join(' → ');
}

/** The facts under a selected shape. Only what is computed: a real start, a
 * real walk total when every leg resolves, a real price band. A leg with no
 * coordinates drops the walk claim rather than printing a null as copy —
 * "walk time not listed" was honest, but repeated three times it read as
 * broken, and the fix for the missing number is coordinates, not wording. */
function shapeFactLine(solved: SolvedNight, dinnerTimeLabel: string, walkMinutes: number | null): string {
  const startsAt = solved.event?.time ?? (solved.restaurant ? dinnerTimeLabel : null);
  const walk = walkMinutes === null ? null : walkMinutes === 0 ? 'no walking' : `${walkMinutes} min walk`;
  return [startsAt ? `from ${startsAt}` : null, walk, solved.restaurant?.price].filter(Boolean).join(' · ');
}

/** A solved shape as one comparable row. The picker shows every shape the
 * engine returned rather than one card and a dice button. */
function ShapeTile({
  theme,
  solved,
  selectedDateAt,
  selected,
  onPress,
}: {
  theme: string;
  solved: SolvedNight;
  selectedDateAt: Date;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { order, dinnerTimeLabel, walkMinutes } = useShapeFacts(solved, selectedDateAt);
  const route = shapeRoute(solved, order);
  const facts = shapeFactLine(solved, dinnerTimeLabel, walkMinutes);
  // One swatch per stop, tinted by kind. Fills dead space at the right edge with
  // the night's composition, so rows differ in weight instead of being three
  // identical slabs — and it is information, not texture: two blocks or three,
  // and which kinds, readable before the row is opened.
  const swatches = order
    .map((kind) => {
      const present = kind === 'dinner' ? solved.restaurant : kind === 'event' ? solved.event : solved.nightlifeSpot;
      if (!present) return null;
      return kind === 'dinner' ? colors['accent-tint'] : kind === 'event' ? colors['vee-tint'] : colors['warm-tint'];
    })
    .filter((tint): tint is string => Boolean(tint));

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${theme}. ${route}${facts ? `. ${facts}` : ''}`}
      activeOpacity={0.78}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.bg : colors['surface-soft'],
        borderColor: selected ? colors['accent-fill'] : colors['edge-soft'],
        borderWidth: StyleSheet.hairlineWidth,
      }}
      className="mb-1.5 flex-row items-start gap-x-3 rounded-panel px-3 py-2.5">
      <View
        style={{
          borderColor: selected ? colors['accent-fill'] : colors.edge,
          borderWidth: selected ? 5 : 1.5,
          marginTop: 2,
        }}
        className="h-[18px] w-[18px] shrink-0 rounded-full"
      />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-fraunces text-[14px] leading-[18px] text-ink">{theme}</Text>
        <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{route}</Text>
        {/* Every row carries its numbers, so all three are the same height and
         * are compared on their contents rather than on their size. Selection
         * pays off by promoting this line — muted to ink, regular to medium —
         * rather than by revealing it, which made the chosen row grow and the
         * other two read as lesser options. Medium rather than bold: three
         * rows of small tabular metadata carry enough weight already, and the
         * colour shift is what actually marks the selection. */}
        {facts ? (
          <Text
            numberOfLines={1}
            style={{ fontVariant: ['tabular-nums'], color: selected ? colors.fg : colors['fg-muted'] }}
            className={`mt-1 text-meta ${selected ? 'font-dm-medium' : 'font-dm'}`}>
            {facts}
          </Text>
        ) : null}
      </View>
      {/* Radius is inline rather than on the scale: these are 13pt data marks,
       * not cards, and the smallest scale step (control, 12pt) would round a
       * block this narrow into a lozenge. */}
      <View className="shrink-0 flex-row gap-x-1 pt-0.5">
        {swatches.map((tint, index) => (
          <View key={index} style={{ backgroundColor: tint, borderRadius: 3 }} className="h-[22px] w-[13px]" />
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string;
    focus?: string;
    eventId?: string;
    restaurantId?: string;
    nightlifeId?: string;
    venueId?: string;
    crawlId?: string;
  }>();
  const {
    budgetPreference,
    deviceLocation,
    pacePreference,
    plans,
    session,
    setBudgetPreference,
    setStartTimePreference,
    setWalkBudgetMinutes,
    startTimePreference,
    stay,
    tasteTags,
    tripContext,
    wantsNightlife,
    setAskPlan,
    askPlan,
    askRequest,
    savedPlaceKeys,
    walkBudgetMinutes,
  } = useScoper();
  const colors = useThemeColors();
  const raisedSurface = useRaisedSurface(2);
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const weatherNow = useWeatherNow();
  const moodVocabulary = useMemo(() => tasteVocabulary(), []);
  const pace = pacePreference ?? 'Relaxed';
  const budget = budgetPreference ?? '$$';
  const startTime = startTimePreference ?? '7:00 PM';
  const anchor: GeoPoint | null = deviceLocation;

  const stayActive = Boolean(stay && isStayActive(stay));
  const currentDateIso = useMemo(() => currentNightIso(stay ?? null), [stay]);
  const selectedDateAt = useMemo(() => {
    const at = parseDateOnly(currentDateIso);
    at.setHours(12);
    return at;
  }, [currentDateIso]);
  const headerContextLabel = stayActive ? `Night ${stayProgress(stay!).currentNight}` : 'Tonight';
  const cityLabel = cityStateDisplayLabel(deviceLocation, GUEST.city, 'CA');
  /** Proof that the list is about tonight rather than any night: the weekday
   * plus whatever the forecast actually says right now.
   *
   * No sunset time. The app holds no sunset — daylightRemaining is hour-granular
   * and its own contract is to return a boundary "never as a guessed sunset" —
   * so printing one would be inventing the most checkable number on the screen.
   * Weather is omitted entirely when no forecast covers now. */
  const headerLocationLabel = useMemo(() => {
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' }).format(new Date());
    return [cityLabel, weekday, weatherNow ? weatherLine(weatherNow) : null].filter(Boolean).join(' \u00b7 ');
  }, [cityLabel, weatherNow]);
  const hasReminders = activeReminders(plans, stay).length > 0;
  const profileInitial = (session?.user.name?.trim().slice(0, 1) || 'G').toUpperCase();
  const reduceMotion = useReducedMotionPreference();
  // ── Composer ──────────────────────────────────────────────────────────
  const [promptText, setPromptText] = useState('');
  const [asking, setAsking] = useState(false);
  const { open: composerPicker, toggle: toggleComposerPicker, close: closeComposerPicker, motion: pickerMotion } =
    useConstraintPicker<Exclude<ComposerPicker, null>>();
  const focusedInputRef = useRef<TextInput>(null);
  const [sendMotion] = useState(() => new Animated.Value(0));
  const [planMotion] = useState(() => new Animated.Value(1));
  // A ref, not state: this only gates "have we already submitted this exact
  // deep-linked query" inside the effect below — it's never read for render,
  // so tracking it in state would just be a synchronous setState-in-effect
  // (cascading render) for no visible benefit.
  const handledQueryRef = useRef<string | null>(null);
  const handledFocusRef = useRef(false);

  /** Example rows fill the primary field in place so typing never changes
   * layers or loses context behind the keyboard. */
  const prefillPrimary = (text: string) => {
    if (asking) return;
    setPromptText(text);
    setTimeout(() => focusedInputRef.current?.focus(), 0);
  };

  const promptReady = Boolean(promptText.trim());
  useEffect(() => {
    const value = promptReady ? 1 : 0;
    if (reduceMotion) {
      sendMotion.setValue(value);
      return;
    }
    const animation = Animated.spring(sendMotion, {
      toValue: value,
      damping: 16,
      stiffness: 260,
      mass: 0.65,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [promptReady, reduceMotion, sendMotion]);

  // A venue/crawl CTA anchor (from their own "Plan a night around this")
  // — the venue's own address, or a crawl's first stop by name (crawl stops
  // carry no structured address, so this is a best-effort real-coords match,
  // never an invented position; curatedCoords already returns null rather
  // than guess when nothing resolves).
  const ctaAnchorPoint: GeoPoint | null = params.venueId
    ? (VENUES[params.venueId] ? curatedCoords(VENUES[params.venueId]) : null)
    : params.crawlId
      ? (CRAWLS[params.crawlId]?.stops[0] ? curatedCoords({ name: CRAWLS[params.crawlId].stops[0].name }) : null)
      : null;

  const submitAsk = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || asking) return;
    Keyboard.dismiss();
    closeComposerPicker();
    setAsking(true);
    // Recorded before the request resolves: an ask worth reusing is worth
    // keeping even when the network leg fails.
    void recordRecentAsk(trimmed).catch(() => undefined);

    // The model call is the only network step — loadDinnerHistory and
    // readSyncStatus are local/Supabase reads that don't depend on its
    // result, so they run alongside it instead of waiting their turn after.
    const [parsed, recentRestaurantIds, syncRows] = await Promise.all([
      requestConciergeRequest(trimmed, moodVocabulary),
      loadDinnerHistory(),
      readSyncStatus(),
    ]);

    let request = parsed;
    if (!request) {
      // Local fallback for offline/development or direct CTA links
      request = {
        intent: 'plan_evening',
        domains: [],
        exclusions: [],
        hardExclusions: [],
        occasion: null,
        rawText: trimmed,
        pace: pace,
        budget: budget,
        moodTags: [],
        timeWindow: { startsBy: null, backBy: null },
        wantsNightlife: Boolean(wantsNightlife),
        confidence: 'medium',
      };
    }

    // 'refine' merges onto the plan already on screen (concierge/adapter.ts's
    // mergeRefineRequest) rather than treating a short "make that cheaper" as
    // a whole new ask that silently drops the pace/mood/exclusions already
    // established. With no previous plan to merge onto, it's left as 'refine'
    // and falls through the next check to the same route/answer.tsx already
    // renders an honest decline for.
    const isRefine = request.intent === 'refine' && Boolean(askRequest && askPlan);
    const effectiveRequest = isRefine ? mergeRefineRequest(askRequest!, request) : request;

    // Not every question is an evening. Anything that isn't gets the shape it
    // asked for — this is the routing step that stops /plan from being the
    // answer to every sentence.
    if (effectiveRequest.intent !== 'plan_evening') {
      setAsking(false);
      setPromptText('');
      router.push(routeForRequest(effectiveRequest));
      return;
    }

    // Explicit prompt wording wins. Composer filters fill only the parts the
    // guest did not already state, and the normalized request is retained so
    // a later "make that cheaper" refine keeps this chosen start time.
    const selectedStartsBy = to24Hour(startTimePreference);
    const planRequest = {
      ...effectiveRequest,
      pace: effectiveRequest.pace ?? pace,
      budget: effectiveRequest.budget ?? budget,
      timeWindow: {
        ...effectiveRequest.timeWindow,
        startsBy: effectiveRequest.timeWindow.startsBy ?? selectedStartsBy,
      },
    };

    const rawPlan = buildPlan(
      planRequest,
      {
        anchor,
        tasteTags,
        coordsOf: curatedCoords,
        hoursOf: curatedHours,
        weather: weatherNow,
        now: resolveAskNow(new Date()),
        recentRestaurantIds,
        targetEventId: params.eventId ?? null,
        targetRestaurantId: params.restaurantId ?? null,
        targetNightlifeId: params.nightlifeId ?? null,
        venueId: params.venueId ?? null,
        anchorPoint: ctaAnchorPoint,
        avoidRestaurantId: isRefine ? (askPlan!.solved.restaurant?.id ?? null) : null,
        avoidEventId: isRefine ? (askPlan!.solved.event?.id ?? null) : null,
        allowVariety: true,
        stay: stay ?? null,
      },
    );
    const plan = applyFreshness(rawPlan, planRequest.pace, syncRows);

    setAsking(false);
    // 'concierge' only when the model actually answered. When it did not,
    // submitAsk built the request itself a few lines up and the night was
    // solved locally — /plan must not put the concierge's name on that.
    setAskPlan(plan, planRequest, parsed ? 'concierge' : 'local');
    setPromptText('');
    router.push('/plan');
  };

  useEffect(() => {
    const query = params.q?.trim();
    const key = `${params.q || ''}_${params.eventId || ''}_${params.restaurantId || ''}_${params.nightlifeId || ''}_${params.venueId || ''}_${params.crawlId || ''}`;
    if (query && key !== handledQueryRef.current) {
      handledQueryRef.current = key;
      setPromptText(query);
      void submitAsk(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.eventId, params.restaurantId, params.nightlifeId, params.venueId, params.crawlId]);

  // Home can focus the primary field without supplying an ask. A q param is
  // authoritative and keeps its existing immediate-submit behavior. Consume
  // the flag after focusing so Home can launch this state again later even
  // while the mounted Plans tab keeps its component state.
  useEffect(() => {
    if (params.focus !== '1') {
      handledFocusRef.current = false;
      return;
    }
    if (params.q?.trim() || handledFocusRef.current) return;
    handledFocusRef.current = true;
    setTimeout(() => focusedInputRef.current?.focus(), 0);
    router.setParams({ focus: undefined });
  }, [params.focus, params.q, router]);

  // ── Ready-made tonight ───────────────────────────────────────────────────
  // Same real pipeline "Plan my stay" always used: taste affinity, walkability
  // (CLAUDE.md #2), open-now at the actual hour (CLAUDE.md #3), never
  // hard-dropping a candidate for being closed or far — only outscoring it.
  const [recentRestaurantIds, setRecentRestaurantIds] = useState<string[] | null>(null);
  useEffect(() => {
    loadDinnerHistory().then(setRecentRestaurantIds);
  }, []);
  const isSolving = recentRestaurantIds === null;
  const tasteKey = tasteTags.join(',');
  const recentRestaurantKey = (recentRestaurantIds ?? []).join(',');

  const rankedEventsAll = useMemo(() => {
    const onThisDate = currentEventListings(selectedDateAt).filter((e: ScoperEvent) => isEventToday(e, selectedDateAt));
    return rankEvents(onThisDate, { tasteTags, vibes: tasteTags.filter((tag): tag is string => ['Foodie', 'Outdoors', 'Nightlife'].includes(tag)), weather: weatherNow, budget: budget, tripContext });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateAt, tasteKey, weatherNow, tripContext]);

  // The guest's own "Start" constraint only applies when nothing real already
  // anchors the night — an event's actual curtain time is a stronger, more
  // specific fact than a guest-picked default (CLAUDE.md #3).
  const topEvent = rankedEventsAll[0]?.item ?? null;
  const dinnerAt = useMemo(() => {
    // Precedence: a real curtain time, then the guest's own Start constraint,
    // then the trip-context default the arrival sequence promised, then 7 PM.
    const computed = computeDinnerTime(topEvent, selectedDateAt, null, defaultDinnerMinutes(tripContext));
    if (topEvent) return computed;
    return applyTimeOfDay(selectedDateAt, startTime) ?? computed;
  }, [topEvent, selectedDateAt, startTime, tripContext]);
  // Clusters dinner/nightlife picks around the anchor event's own
  // neighborhood — null when there's no event tonight, so nothing forces a
  // clustering bonus that has nothing real to anchor to.
  const anchorMicroDistrict = useMemo(() => microDistrictOf(topEvent?.addr ?? null), [topEvent]);
  // No linked stay (or a single-night one) always resolves to 'middle' —
  // today's flat weighting, unchanged.
  const arcPosition = useMemo(() => (stayActive ? stayArcPosition(stay!, currentDateIso) : 'middle'), [stayActive, stay, currentDateIso]);
  const recentCuisines = useMemo(
    () => (recentRestaurantIds ?? []).map((id) => RESTAURANTS[id]?.cuisine).filter((c): c is string => Boolean(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentRestaurantKey],
  );
  const recentMicroDistricts = useMemo(
    () => (recentRestaurantIds ?? []).map((id) => microDistrictOf(RESTAURANTS[id]?.address ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentRestaurantKey],
  );

  const rankedRestaurantsAll = useMemo(
    () =>
      rankRestaurants(Object.values(RESTAURANTS), {
        budget,
        tasteTags,
        vibes: tasteTags.filter((tag): tag is string => ['Foodie', 'Outdoors', 'Nightlife'].includes(tag)),
        anchor,
        coordsOf: curatedCoords,
        hoursOf: curatedHours,
        dinnerAt,
        recentRestaurantIds: recentRestaurantIds ?? [],
        savedPlaceKeys: savedPlaceKeys ?? [],
        anchorMicroDistrict,
        arcPosition,
        recentCuisines,
        recentMicroDistricts,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budget, tasteKey, anchor, curatedCoords, curatedHours, dinnerAt, recentRestaurantKey, anchorMicroDistrict, arcPosition, recentCuisines, recentMicroDistricts],
  );

  // Nightcap inclusion: an explicit "+ Add" beats the pace default, but
  // there's no way to explicitly opt back OUT at Packed pace yet — the "+Add"
  // sheet only offers turning it on (CLAUDE.md: no invented toggle states).
  const includeNightlife = wantsNightlife === true || pace === 'Packed';
  // Ranked unconditionally now: the third shape ("Late & loud") is a solve that
  // always ends on a nightcap, so the pool has to exist even when the guest's
  // own constraints don't ask for one. Ranking a 20-item static list is cheap.
  const rankedNightlifeAll = useMemo(
    () => rankNightlife(NIGHTLIFE_SPOTS, { tasteTags, anchor, coordsOf: curatedCoords, anchorMicroDistrict }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasteKey, anchor, curatedCoords],
  );

  const [avoidIds, setAvoidIds] = useState<{ restaurantIds: string[]; eventIds: string[]; nightlifeIds: string[] }>({
    restaurantIds: [],
    eventIds: [],
    nightlifeIds: [],
  });
  // Which shape is open, and where we are in the regenerate cycle. Both are
  // positional rather than keyed on a solve, because a re-solve replaces every
  // card's identity while the guest's place in the list stays put.
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  // A constraint change reshapes the whole candidate pool — steering away
  // from picks that made sense under the old constraints isn't a real signal
  // for the new ones, so it's reset here, adjusted during render (React's own
  // pattern for state that depends on another value changing).
  const constraintKey = `${pace}|${budget}|${startTime}|${includeNightlife}`;
  const [avoidConstraintKey, setAvoidConstraintKey] = useState(constraintKey);
  if (constraintKey !== avoidConstraintKey) {
    setAvoidConstraintKey(constraintKey);
    setAvoidIds({ restaurantIds: [], eventIds: [], nightlifeIds: [] });
    setSetIndex(0);
    setExpandedIndex(0);
  }

  const solveOne = (
    avoid: { restaurantId: string[]; eventId: string[]; nightlifeId: string[] },
    withNightlife = includeNightlife,
  ) =>
    solveNight({
      restaurants: rankedRestaurantsAll,
      events: rankedEventsAll,
      nightlife: withNightlife ? rankedNightlifeAll : null,
      coordsOfRestaurant: curatedCoords,
      coordsOfEvent: (e) => curatedCoords({ name: e.venue }),
      coordsOfNightlife: curatedCoords,
      pace,
      locked: {},
      avoid,
    });

  const primary = useMemo(
    () => solveOne({ restaurantId: avoidIds.restaurantIds, eventId: avoidIds.eventIds, nightlifeId: avoidIds.nightlifeIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rankedRestaurantsAll, rankedEventsAll, rankedNightlifeAll, pace, avoidIds],
  );
  const secondary = useMemo(
    () =>
      solveOne({
        restaurantId: [...avoidIds.restaurantIds, ...(primary.restaurant ? [primary.restaurant.id] : [])],
        eventId: [...avoidIds.eventIds, ...(primary.event ? [primary.event.id] : [])],
        nightlifeId: [...avoidIds.nightlifeIds, ...(primary.nightlifeSpot ? [primary.nightlifeSpot.id] : [])],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, avoidIds],
  );

  // The third shape: the same pipeline, forced to end on a nightcap and steered
  // off both earlier picks. Null when there is no nightlife to end on — a card
  // named "Late & loud" with nothing late in it would be a label, not a plan.
  const nightcap = useMemo(
    () =>
      rankedNightlifeAll.length
        ? solveOne(
            {
              restaurantId: [
                ...avoidIds.restaurantIds,
                ...(primary.restaurant ? [primary.restaurant.id] : []),
                ...(secondary.restaurant ? [secondary.restaurant.id] : []),
              ],
              eventId: [...avoidIds.eventIds, ...(primary.event ? [primary.event.id] : []), ...(secondary.event ? [secondary.event.id] : [])],
              nightlifeId: avoidIds.nightlifeIds,
            },
            true,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, secondary, avoidIds, rankedNightlifeAll],
  );

  const readyMadeCards = useMemo(() => {
    if (!primary.restaurant && !primary.event) return [];
    const cards = [{ theme: 'Low-key & walkable', solved: primary }];
    if ((secondary.restaurant || secondary.event) && !sameSolve(primary, secondary)) {
      cards.push({ theme: 'Big night out', solved: secondary });
    }
    if (nightcap?.nightlifeSpot && !cards.some((card) => sameSolve(card.solved, nightcap))) {
      cards.push({ theme: 'Late & loud', solved: nightcap });
    }
    return cards;
  }, [primary, secondary, nightcap]);

  const avoidAllOf = (cards: { solved: SolvedNight }[]) => ({
    restaurantIds: cards.map((card) => card.solved.restaurant?.id).filter((id): id is string => Boolean(id)),
    eventIds: cards.map((card) => card.solved.event?.id).filter((id): id is string => Boolean(id)),
    nightlifeIds: cards.map((card) => card.solved.nightlifeSpot?.id).filter((id): id is string => Boolean(id)),
  });

  /** Advances one step through the regenerate cycle, steering off everything on
   * screen. The last step wraps to the start by clearing the avoid list, which
   * is what makes "N of 3" true rather than decorative. */
  const cycleSet = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = (setIndex + 1) % PLAN_SETS;
    setSetIndex(next);
    setExpandedIndex(0);
    if (next === 0) {
      setAvoidIds({ restaurantIds: [], eventIds: [], nightlifeIds: [] });
      return;
    }
    const seen = avoidAllOf(readyMadeCards);
    setAvoidIds((prev) => ({
      restaurantIds: [...new Set([...prev.restaurantIds, ...seen.restaurantIds])],
      eventIds: [...new Set([...prev.eventIds, ...seen.eventIds])],
      nightlifeIds: [...new Set([...prev.nightlifeIds, ...seen.nightlifeIds])],
    }));
  };

  const chooseReadyMade = async (solved: SolvedNight, themeName?: string) => {
    // Awaited, not fire-and-forget: /plan-draft's own load effect only runs
    // once on mount, so navigating before this write lands would leave it
    // reading the draft that existed before "Use this" was tapped.
    await saveNightDraft(stay ?? null, currentDateIso, {
      generated: true,
      restaurantId: solved.restaurant?.id ?? null,
      eventId: solved.event?.id ?? null,
      nightlifeSpotId: solved.nightlifeSpot?.id ?? null,
      lockedRestaurant: false,
      lockedEvent: false,
      lockedNightlife: false,
      // Carries the door and the choice across the tap, so the draft screen can
      // greet an accepted plan differently from a from-scratch build.
      source: 'vee',
      themeName,
    });
    // Both doors now land on /plan. The draft above is still written — it is
    // what Refine opens — but a shape is a built night like any other, and
    // sending it straight to the builder made "Use this plan" mean something
    // different from Ask when they do the same job. planFromShape wraps the
    // solved night in the shape /plan renders; the request is null because a
    // shape had no ask behind it, which also means a following "make it
    // cheaper" is read as a new ask rather than a merge.
    setAskPlan(planFromShape(solved, selectedDateAt, curatedCoords), null, 'shape');
    router.push('/plan');
  };

  const openIndex = Math.min(expandedIndex, Math.max(0, readyMadeCards.length - 1));
  const focusedCard = readyMadeCards[openIndex] ?? null;
  const focusedCardKey = focusedCard
    ? `${setIndex}-${openIndex}-${focusedCard.theme}-${focusedCard.solved.restaurant?.id ?? ''}-${focusedCard.solved.event?.id ?? ''}`
    : 'empty';

  useEffect(() => {
    if (!focusedCard) return;
    if (reduceMotion) {
      planMotion.setValue(1);
      return;
    }
    planMotion.setValue(0);
    const animation = Animated.timing(planMotion, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [focusedCard, focusedCardKey, planMotion, reduceMotion]);

  /** Keep the reference behavior inside the primary page: typing searches the
   * same catalog as global search, while the Vee action remains the first row. */
  const allPlaces = useAllPlaces();
  const allPicks = useViatorPicks();
  const searchIndex = useMemo(() => buildSearchIndex(allPlaces, allPicks), [allPlaces, allPicks]);
  const liveMatches = useMemo(() => {
    const trimmed = promptText.trim();
    if (trimmed.length < 2) return [];
    return queryIndex(searchIndex, trimmed, tasteTags).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchIndex, promptText, tasteKey]);
  const showingLiveMatches = promptText.trim().length >= 2;
  const liveMatchFamilies = new Set(liveMatches.map((match) => SEARCH_RESULT_FAMILIES[match.kind]));
  const showLiveKindLabels = liveMatchFamilies.size > 1;
  const liveMatchesAreNearby = liveMatches.length > 0 && liveMatches.every((match) => NEARBY_RESULT_KINDS.has(match.kind));
  const trimmedLiveQuery = promptText.trim();
  const liveMatchHeading = liveMatchesAreNearby
    ? `${trimmedLiveQuery.slice(0, 1).toUpperCase()}${trimmedLiveQuery.slice(1)} nearby`
    : 'Best matches';
  const liveMatchCountLabel = `${liveMatches.length} ${liveMatchesAreNearby
    ? liveMatches.length === 1 ? 'place' : 'places'
    : liveMatches.length === 1 ? 'result' : 'results'}`;

  /** The example the ask box shows at rest. A label, never prefilled text — it
   * demonstrates a good ask without putting words in the guest's mouth, so it
   * is deliberately not seeded into promptText. Built off tonight's real
   * anchor event when there is one. */
  const askExampleLabel = useMemo(() => {
    const nearby = rankedRestaurantsAll[0]?.item;
    if (nearby) return `Somewhere like ${nearby.name}, but I want options`;
    if (topEvent) return `Something near ${topEvent.venue}`;
    return 'Dinner somewhere walkable, then a drink';
  }, [topEvent, rankedRestaurantsAll]);

  /** Starters that say a real name out loud — "Date for 2 at Nido", "Tickets to
   * Brandon Flowers at Fox Theater" — instead of a generic verb. Every name is
   * read off the same ranked catalog the shapes below are solved from, so a chip
   * can never advertise somewhere that isn't on the map (CLAUDE.md #6); a night
   * with nothing listed drops the chip rather than filling it with a
   * plausible-sounding name. The name is carried into the query verbatim too,
   * which is what lets an "open late" ask resolve against the real catalog
   * (concierge/fact.ts) instead of declining as unresolvable.
   *
   * The row scrolls, so the count is bounded by what's worth suggesting rather
   * than by what fits on one line. */
  const askExamples = useMemo(() => {
    // The placeholder above already names the top-ranked restaurant, so the
    // chips start one below it rather than echoing the field they sit under.
    const [dateSpot, nearbySpot, groupSpot] = rankedRestaurantsAll.slice(1, 4).map((ranked) => ranked.item);
    // Tonight's listings first, then the next ticketed show on the calendar —
    // "tickets to X" claims no date, so an upcoming one is still honest. Only a
    // ticketed listing gets a ticket chip; a free night isn't sold.
    const show =
      rankedEventsAll.map((ranked) => ranked.item).find((event) => event.ticketed) ??
      currentEventListings(selectedDateAt).find((event) => event.ticketed) ??
      null;
    const freeTonight = rankedEventsAll.some((ranked) => /free|no cover/i.test(ranked.item.priceLabel));
    const spots = rankedNightlifeAll.map((ranked) => ranked.item);
    // Only somewhere the catalog itself calls a cocktail bar gets a cocktail
    // chip; anywhere else is offered as plain drinks.
    const cocktailBar = spots.find((spot) => /cocktail/i.test(spot.kind));
    const drinksSpot = cocktailBar ?? spots[0];
    const lateSpot = spots.find((spot) => /12|1 ?am|2 ?am|late/i.test(spot.hours));

    return [
      dateSpot
        ? {
            query: `Plan a date night for two at ${dateSpot.name}, then somewhere for a drink.`,
            action: `Date for 2 at ${dateSpot.name}`,
            glyph: 'calendar',
            tone: 'accent',
          }
        : null,
      show
        ? {
            query: `Tickets to ${show.name} at ${show.venue}.`,
            action: `Tickets to ${show.name} at ${show.venue}`,
            glyph: 'ticket',
            tone: 'warm',
          }
        : null,
      drinksSpot
        ? {
            query: `Plan dinner, then ${cocktailBar ? 'cocktails' : 'drinks'} at ${drinksSpot.name}.`,
            action: `${cocktailBar ? 'Cocktails' : 'Drinks'} at ${drinksSpot.name}`,
            glyph: 'drink',
            tone: 'vee',
          }
        : null,
      topEvent
        ? {
            query: `Somewhere walkable for dinner near ${topEvent.venue}.`,
            action: `Dinner near ${topEvent.venue}`,
            glyph: 'food',
            tone: 'accent',
          }
        : nearbySpot
          ? {
              query: `Somewhere walkable for dinner in the next hour, like ${nearbySpot.name}.`,
              action: `Dinner near ${nearbySpot.name}`,
              glyph: 'food',
              tone: 'accent',
            }
          : null,
      groupSpot
        ? {
            query: `Plan a night out for six, starting with dinner at ${groupSpot.name}.`,
            action: `Dinner for six at ${groupSpot.name}`,
            glyph: 'user',
            tone: 'vee',
          }
        : null,
      lateSpot
        ? { query: `Is ${lateSpot.name} open late tonight?`, action: `Is ${lateSpot.name} open late?`, glyph: 'clock', tone: 'warm' }
        : null,
      // Only offered on a night that actually has a free listing behind it.
      freeTonight ? { query: 'What’s free tonight?', action: 'What’s free tonight?', glyph: 'spark', tone: 'vee' } : null,
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [rankedRestaurantsAll, rankedEventsAll, rankedNightlifeAll, topEvent, selectedDateAt]);

  return (
    <Screen>
        <ScreenScroll
          gap={0}
          clearsTabBar
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
          <HomeHeader
            locationLabel={headerLocationLabel}
            initial={profileInitial}
            hasReminders={hasReminders}
            onNotifications={() => router.push('/notifications')}
            onProfile={() => router.push('/profile')}
          />

          <Text className="mt-8 max-w-[340px] font-fraunces-medium text-display text-ink">
            {askPlan ? 'What should change?' : 'What mood are we chasing?'}
          </Text>

          {/* The plan being refined, kept on the screen you refine it from.
            * Refine used to land here with nothing on it, so a guest described
            * a change to something they could no longer see — and the merge
            * that makes "make it cheaper" work (mergeRefineRequest) was
            * invisible. Nothing about the routing changed; the plan is simply
            * still here. */}
          {askPlan ? (
            <View style={raisedSurface} className="mt-5 flex-row items-center gap-x-3 rounded-panel px-3.5 py-3">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Back to the plan: ${shapeRoute(askPlan.solved, askPlan.stopOrder)}`}
                activeOpacity={0.72}
                onPress={() => router.push('/plan')}
                className="min-w-0 flex-1">
                <View className="flex-row items-center gap-x-1.5">
                  <Glyph name="spark" size={12} color={colors['vee-strong']} strokeWidth={1.9} />
                  <Text style={{ color: colors['vee-strong'] }} className="font-dm-bold text-micro uppercase tracking-[0.5px]">
                    On screen now
                  </Text>
                </View>
                <Text numberOfLines={1} className="mt-1 font-dm-bold text-body text-ink">
                  {shapeRoute(askPlan.solved, askPlan.stopOrder) || 'Tonight’s plan'}
                </Text>
                {shapeFactLine(askPlan.solved, askPlan.dinnerTimeLabel, totalWalkMinutes(askPlan.stopLegs)) ? (
                  <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                    {shapeFactLine(askPlan.solved, askPlan.dinnerTimeLabel, totalWalkMinutes(askPlan.stopLegs))}
                  </Text>
                ) : null}
              </TouchableOpacity>
              {/* Dismissing is abandoning — setAskPlan(null) records it as
                * that, the same as navigating away without acting on it. */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear this plan and start a new ask"
                activeOpacity={0.7}
                hitSlop={8}
                onPress={() => setAskPlan(null)}
                className="h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Glyph name="close" size={15} color={colors['fg-muted']} strokeWidth={1.9} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* The ask box. The example is a label rather than prefilled text, and
           * Vee's assumptions ride underneath it as one line of type — five pill
           * controls made the assumptions look like the point of the screen. */}
          <View
            style={[
              raisedSurface,
              { borderWidth: StyleSheet.hairlineWidth, borderColor: colors['vee-tint'], opacity: asking ? 0.72 : 1 },
            ]}
            className="mt-5 rounded-panel px-3.5 pb-3 pt-3">
            <View className="flex-row items-center gap-x-1.5">
              <Glyph name="spark" size={13} color={colors['vee-strong']} strokeWidth={1.9} />
              <Text style={{ color: colors['vee-strong'] }} className="font-dm text-[9.5px] leading-3">
                Ask Vee
              </Text>
            </View>

            {/* No fill: a shaded well inside an already-raised card read as a
              * second surface stacked on the first. The hairline is enough to
              * say "field", and the ask now sits on the card's own paper. */}
            <View
              style={{ borderColor: colors['edge-soft'], borderWidth: StyleSheet.hairlineWidth }}
              className="mt-2.5 rounded-control px-3 py-2.5">
              <TextInput
                ref={focusedInputRef}
                accessibilityLabel="Ask Vee"
                accessibilityHint={`For example: ${askExampleLabel}`}
                value={promptText}
                onChangeText={setPromptText}
                placeholder={askExampleLabel}
                placeholderTextColor={colors.fg}
                multiline
                numberOfLines={2}
                scrollEnabled
                maxLength={500}
                editable={!asking}
                textAlignVertical="top"
                className="h-10 font-fraunces-medium text-[15px] leading-5 text-ink"
                style={{ padding: 0 }}
              />
            </View>

            <View className="mt-2.5 flex-row items-center">
              <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
                <MetaValue
                  constraint="start time"
                  glyph="clock"
                  label={`By ${startTime.replace(':00', '')}`}
                  onPress={() => toggleComposerPicker('time')}
                />
                <MetaValue constraint="budget" glyph="wallet" label={budget} onPress={() => toggleComposerPicker('budget')} />
                <MetaValue
                  constraint="walking limit"
                  glyph="route"
                  label={walkBudgetMinutes ? `${walkBudgetMinutes} min` : 'Any walk'}
                  onPress={() => toggleComposerPicker('walk')}
                />
              </View>
              <Animated.View style={{ transform: [{ scale: sendMotion.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
                {/* Live on an empty field, not disabled. The example on screen is
                 * a real, answerable ask built from tonight's anchor, so Ask
                 * sends that — a guest who taps without typing gets a good night
                 * rather than a dead button. Anything typed wins over it. */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={promptReady ? 'Submit request' : `Ask Vee: ${askExampleLabel}`}
                  accessibilityState={{ disabled: asking }}
                  activeOpacity={0.82}
                  hitSlop={6}
                  disabled={asking}
                  onPress={() => void submitAsk(promptReady ? promptText : askExampleLabel)}
                  style={{ opacity: asking ? 0.48 : 1 }}
                  className="ml-2 h-8 shrink-0 flex-row items-center justify-center gap-x-1 rounded-full bg-ember px-3.5">
                {asking ? (
                  <ActivityIndicator size="small" color={colors['on-accent']} />
                  ) : (
                  <>
                    <Text className="font-dm-bold text-[11px] text-on-accent">Ask</Text>
                    <Glyph name="arrow" size={13} color={colors['on-accent']} strokeWidth={2.1} />
                  </>
                )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {composerPicker ? (
            <View className="mt-2">
              <ConstraintRail
                motion={pickerMotion}
                onChoose={closeComposerPicker}
                options={(composerPicker === 'time'
                  ? START_TIME_OPTIONS
                  : composerPicker === 'budget'
                    ? BUDGET_OPTIONS
                    : WALK_BUDGET_OPTIONS
                ).map((option) => ({
                  key: String(option),
                  label: option === null ? 'No walk limit' : composerPicker === 'walk' ? `${option} min walk` : String(option),
                  selected:
                    composerPicker === 'time'
                      ? option === startTimePreference
                      : composerPicker === 'budget'
                        ? option === budget
                        : option === walkBudgetMinutes,
                  onSelect: () => {
                    if (composerPicker === 'time' && typeof option === 'string') {
                      setStartTimePreference(option === startTimePreference ? null : option);
                    } else if (composerPicker === 'budget' && typeof option === 'string') {
                      setBudgetPreference(option as (typeof BUDGET_OPTIONS)[number]);
                    } else if (composerPicker === 'walk') {
                      setWalkBudgetMinutes(option as (typeof WALK_BUDGET_OPTIONS)[number]);
                    }
                  },
                }))}
              />
            </View>
          ) : null}

          {showingLiveMatches ? (
            <View style={raisedSurface} className="mt-3 rounded-panel px-3 py-3">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Ask Vee to plan around ${promptText.trim()}`}
                accessibilityState={{ disabled: asking }}
                activeOpacity={0.78}
                disabled={asking}
                onPress={() => void submitAsk(promptText)}
                style={{ backgroundColor: colors['vee-tint'] }}
                className="flex-row items-center gap-x-2.5 rounded-card px-3 py-3">
                <Glyph name="spark" size={15} color={colors['vee-strong']} strokeWidth={1.8} />
                <Text numberOfLines={1} style={{ color: colors['vee-strong'] }} className="min-w-0 flex-1 font-dm-bold text-label">
                  Ask Vee to plan around this
                </Text>
                <Glyph name="chevron" size={14} color={colors['vee-strong']} strokeWidth={2} />
              </TouchableOpacity>

              {liveMatches.length ? (
                <>
                  <View className="mt-3 flex-row items-baseline justify-between px-1">
                    <Text numberOfLines={1} className="min-w-0 flex-1 font-dm-medium text-body-strong text-ink">
                      {liveMatchHeading}
                    </Text>
                    <Text className="ml-3 shrink-0 font-dm text-label text-taupe">{liveMatchCountLabel}</Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: colors['surface-raised'],
                      borderColor: colors['edge-soft'],
                      borderWidth: StyleSheet.hairlineWidth,
                    }}
                    className="mt-2 overflow-hidden rounded-card">
                    {liveMatches.map((match, index) => (
                      <TouchableOpacity
                        key={`${match.kind}-${match.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${match.title}, ${SEARCH_RESULT_LABELS[match.kind]}, ${match.subtitle}`}
                        accessibilityHint={index === 0 ? 'Best match' : undefined}
                        activeOpacity={0.72}
                        onPress={() => {
                          Keyboard.dismiss();
                          router.push(match.href as never);
                        }}
                        style={{ backgroundColor: index === 0 ? colors['surface-soft'] : colors['surface-raised'] }}
                        className={`min-h-[64px] flex-row items-center gap-x-3 px-3 py-2.5 ${index === 0 ? 'rounded-card' : 'border-t border-sand2'}`}>
                        <View
                          style={{ backgroundColor: colors['vee-tint'] }}
                          className="h-10 w-10 shrink-0 items-center justify-center rounded-full">
                          <Glyph name={SEARCH_RESULT_GLYPHS[match.kind]} size={18} color={colors['vee-strong']} strokeWidth={1.65} />
                        </View>

                        <View className="min-w-0 flex-1">
                          <Text numberOfLines={1} className="font-dm-bold text-body-strong text-ink">{match.title}</Text>
                          <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{match.subtitle}</Text>
                        </View>

                        {showLiveKindLabels ? (
                          <View className="shrink-0 flex-row items-center gap-x-1.5">
                            <View style={{ backgroundColor: colors.vee }} className="h-1.5 w-1.5 rounded-full" />
                            <Text className="font-dm-medium text-micro text-taupe">{SEARCH_RESULT_LABELS[match.kind]}</Text>
                          </View>
                        ) : null}
                        <Glyph name="chevron" size={15} color={colors['fg-muted']} strokeWidth={1.8} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {!showingLiveMatches ? (
            <>
              {/* One compact chip per secondary job. The full example remains
               * behind the tap, where it can teach by filling the real field. */}
              <Text className="mt-5 font-dm-medium text-label text-taupe">Vee can also…</Text>
              {/* A rail rather than a wrap: the list is worth growing past what
               * fits on one line, and HRow already bleeds to the gutters and
               * fades its trailing edge so a half-visible chip reads as "more"
               * instead of a clipped one. */}
              <View className="mt-2">
              <HRow gap={8}>
                {askExamples.map((example) => {
                  const background = example.tone === 'accent'
                    ? colors['accent-tint']
                    : example.tone === 'warm'
                      ? colors['warm-tint']
                      : colors['vee-tint'];
                  const foreground = example.tone === 'accent'
                    ? colors['fg-accent']
                    : example.tone === 'warm'
                      ? colors['warm-strong']
                      : colors['vee-strong'];
                  return (
                    <TouchableOpacity
                      key={example.query}
                      accessibilityRole="button"
                      accessibilityLabel={example.query}
                      accessibilityState={{ disabled: asking }}
                      activeOpacity={0.72}
                      hitSlop={4}
                      disabled={asking}
                      onPress={() => prefillPrimary(example.query)}
                      style={{
                        backgroundColor: background,
                        borderColor: colors['edge-soft'],
                        borderWidth: StyleSheet.hairlineWidth,
                      }}
                      className="min-h-9 flex-row items-center justify-center gap-x-1.5 rounded-full px-2.5 py-2">
                      <Glyph name={example.glyph} size={13} color={foreground} strokeWidth={1.8} />
                      {/* Capped so one unusually long listing name ellipsizes
                        * instead of stretching a chip past the screen; the rail
                        * scrolls, so the rest keep their natural width. */}
                      <Text numberOfLines={1} style={{ color: foreground, maxWidth: 260 }} className="font-dm-medium text-meta">
                        {example.action}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </HRow>
              </View>
            </>
          ) : null}

          {/* All three solved shapes, not one card and a reroll: they are already
           * computed on every render, and three comparable options read as a
           * choice rather than a verdict. */}
          <View className="mt-4">
            {isSolving ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : readyMadeCards.length ? (
              <Animated.View
                key={focusedCardKey}
                style={{
                  opacity: planMotion,
                  transform: [{ translateY: planMotion.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                }}>
                <View className="flex-row items-baseline justify-between">
                  <Text style={{ color: colors['vee-strong'] }} className="font-dm-medium text-[11px] leading-4">
                    Or start from a shape
                  </Text>
                  <Text className="font-dm text-meta text-taupe">
                    {readyMadeCards.length} for {headerContextLabel.toLowerCase()}
                  </Text>
                </View>

                <View className="mt-2">
                  {readyMadeCards.map((card, index) => (
                    <ShapeTile
                      key={`${card.theme}-${card.solved.restaurant?.id ?? ''}-${card.solved.event?.id ?? ''}`}
                      theme={card.theme}
                      solved={card.solved}
                      selectedDateAt={selectedDateAt}
                      selected={index === openIndex}
                      onPress={() => setExpandedIndex(index)}
                    />
                  ))}
                </View>

                {focusedCard ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${focusedCard.theme}`}
                    activeOpacity={0.82}
                    onPress={() => chooseReadyMade(focusedCard.solved, focusedCard.theme)}
                    className="mt-3 min-h-[52px] items-center justify-center rounded-xl bg-ember px-4 py-3.5">
                    <Text className="font-dm-bold text-label text-on-accent">Use this plan</Text>
                  </TouchableOpacity>
                ) : null}

                {/* "Show 3 more · 1 of 3" contradicted the "3 for tonight" above
                 * it — one count promising more, the other saying these are all
                 * of them. Reshuffle replaces the set, so it claims nothing the
                 * header disagrees with. */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Reshuffle, ${readyMadeCards.length} new shapes`}
                  activeOpacity={0.72}
                  onPress={cycleSet}
                  className="mt-1 h-11 flex-row items-center justify-center gap-x-2">
                  <Glyph name="refresh" size={16} color={colors['fg-muted']} strokeWidth={1.7} />
                  <Text className="font-dm-medium text-meta text-taupe">
                    Reshuffle · {readyMadeCards.length} new shapes
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <EmptyState
                compact
                title="Nothing matches that combination yet"
                message="Try a different pace, budget, or start time, or browse Discover instead."
                actionLabel="Browse Discover"
                onAction={() => router.push('/discover')}
              />
            )}
          </View>

          <View className="h-5" />
        </ScreenScroll>
    </Screen>
  );
}
