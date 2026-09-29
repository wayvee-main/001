import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AskVeeRow } from '@/components/ask-vee-row';
import { FactStrip, FoodHubRow, HubDropdown, HubMenu, type HubFact } from '@/components/featured';
import { HeaderRow, HRow, Screen } from '@/components/layout';
import { RaisedView } from '@/components/raised-surface';
import { SectionHeading } from '@/components/section-heading';
import { TrustChip } from '@/components/trust-chip';
import { Glyph } from '@/components/glyph';
import { Chip, EmptyState, SearchIcon } from '@/components/ui';
import {
  DEALS,
  FOOD_HUB_REASON_BY_ID,
  FOOD_HUB_SECTIONS,
  RESTAURANTS,
  applyRestaurantFilters,
  restaurantMetaLine,
  restaurantSearchCue,
  searchFoodHub,
  type Restaurant,
  type RestaurantFilters,
} from '@/lib/data';
import { formatMiles, milesBetween, usableAnchor } from '@/lib/geo';
import { composedTitle, pricePhrase } from '@/lib/hub-copy';
import { recordRestaurantExploration } from '@/lib/exploration-history';
import { useThemeColors } from '@/lib/theme';
import { useNow } from '@/lib/clock';
import { openStateFor } from '@/lib/hours';
import { placeCategoryLabel, useAllPlaces, useCuratedCoords, useCuratedHours, type Place } from '@/lib/places';
import { CATEGORY_SYNONYMS } from '@/lib/search';
import { useScoper } from '@/lib/store';
import { restaurantHaystack, sortByAffinity } from '@/lib/taste';

const RESULTS_CAP = 100;


/** Place['category'] values worth their own chip — mirrors CATEGORY_LABELS in
 * lib/places.ts, alphabetized by label with "All" pinned first. 'other' stays
 * unfiltered (still shows up in results) since it isn't a meaningful bucket. */
const CATEGORY_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'bar', label: 'Bar' },
  { key: 'brewery', label: 'Brewery' },
  { key: 'cafe', label: 'Café' },
  { key: 'night_club', label: 'Nightclub' },
  { key: 'pub', label: 'Pub' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'wine_bar', label: 'Wine bar' },
];

const PRICE_TIERS = ['$', '$$', '$$$'];

/** The three yes/no signals a curated restaurant can actually answer. Each
 * carries its own predicate so the row can ask "can anything here even do
 * this?" before offering the switch. */
const OFFER_SWITCHES: { key: 'openLate' | 'delivery' | 'reserve'; label: string; has: (r: Restaurant) => boolean }[] = [
  { key: 'openLate', label: 'Open late', has: (r) => r.openLate },
  { key: 'delivery', label: 'Delivery', has: (r) => r.hasDelivery },
  { key: 'reserve', label: 'Reserve', has: (r) => Boolean(r.reserveUrl) },
];

const SORTS = ['Best match', 'Nearest', 'Lowest price'];


/** Normalizes any hub listing source into the one shape FoodHubRow renders,
 * so a curated restaurant and a places-directory result are indistinguishable. */
interface HubListing {
  id: string;
  name: string;
  image?: string;
  cue?: string;
  meta?: string;
  href: string;
  /** Real device-relative distance, when coordinates exist for this entry. Drives
   * the nearest-first ordering; absent means "unknown", never "far". */
  miles?: number;
  /** The guest's own taste tag this entry matched, when it matched one. */
  tasteTag?: string;
}

function listingFromRestaurant(restaurant: Restaurant, cue?: string, distanceMiles?: number, tasteTag?: string): HubListing {
  return {
    id: restaurant.id,
    name: restaurant.name,
    image: restaurant.image,
    cue,
    // Real distance replaces the curated Downtown-Oakland estimate whenever it
    // can be computed, so one list never mixes two different reference points.
    meta: distanceMiles != null
      ? [restaurant.cuisine, restaurant.price, `${formatMiles(distanceMiles)} away`].join(' · ')
      : restaurantMetaLine(restaurant),
    href: `/restaurant/${restaurant.id}`,
    miles: distanceMiles,
    tasteTag,
  };
}

function listingFromPlace(place: Place, distanceMiles?: number, tasteTag?: string): HubListing {
  const base = place.address ?? placeCategoryLabel(place);
  // Leads the meta line when it's known: "is it open" outranks "where is it"
  // for a guest deciding right now. Places without readable hours just don't
  // carry the signal — they're never labelled closed by omission.
  const open = openStateFor(place.openingHours);
  const openCue = open.status === 'open' ? 'Open now' : open.status === 'closed' ? 'Closed now' : null;
  return {
    id: place.id,
    name: place.name,
    image: place.image ?? undefined,
    cue: place.cuisine ?? undefined,
    meta: [openCue, distanceMiles != null ? formatMiles(distanceMiles) : null, base].filter(Boolean).join(' · '),
    href: `/place/${place.id}`,
    miles: distanceMiles,
    tasteTag,
  };
}

export default function FeaturedDirectoryScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const s = useScoper();
  const seededQuery = typeof q === 'string' ? q : '';
  const [lastSeed, setLastSeed] = useState(seededQuery);
  const [query, setQuery] = useState(seededQuery);
  if (seededQuery !== lastSeed) {
    setLastSeed(seededQuery);
    setQuery(seededQuery);
  }

  const [category, setCategory] = useState('all');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const colors = useThemeColors();

  const filters: RestaurantFilters = {
    sort: s.sort,
    price: s.price,
    openLate: s.openLate,
    delivery: s.delivery,
    reserve: s.reserve,
  };
  // Which dropdown is open, if any. One at a time — two lists pushing the
  // results down together reads as a menu that lost track of itself.
  const [openMenu, setOpenMenu] = useState<'price' | 'cuisine' | 'sort' | null>(null);
  // Price / delivery / reserve / open-late live only on curated restaurants;
  // the places directory carries none of them. So when one is on, a place
  // cannot answer it, and passing them through as though they had qualified is
  // the sort of quiet lie the rest of this app refuses to tell.
  const restaurantOnlyFilter = Boolean(s.price || s.openLate || s.delivery || s.reserve);
  const normalizedQuery = query.trim().toLowerCase();
  const showHub = category === 'all' && !cuisine && !normalizedQuery && !restaurantOnlyFilter && s.sort === 'Best match';

  const allPlaces = useAllPlaces();

  /** Does this place answer the typed query at all, before any chip narrows it?
   * Split out so the chip rows can be built from what the *query* matched
   * rather than from what is currently on screen — deriving them from the
   * filtered results would delete the chip you just tapped and strand you. */
  const placeMatchesQuery = (place: Place): boolean => {
    if (!normalizedQuery) return true;
    const searchable = [place.name, place.cuisine, placeCategoryLabel(place), CATEGORY_SYNONYMS[place.category], place.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return normalizedQuery.split(' ').filter(Boolean).every((token) => searchable.includes(token));
  };
  const queryPlaces = allPlaces.filter(placeMatchesQuery);
  // The pool the CONTROLS are built from: what the query alone matches, with
  // the switches deliberately off. Deriving them from the filtered set instead
  // would delete the tier you just picked and strand you there with no way
  // back to $$$ except clearing everything.
  const poolFilters: RestaurantFilters = { sort: filters.sort, price: null, openLate: false, delivery: false, reserve: false };
  const queryCurated: Restaurant[] = normalizedQuery ? searchFoodHub(query, poolFilters) : Object.values(RESTAURANTS);

  const cuisines = [...new Set(queryPlaces.map((place) => place.cuisine).filter((c): c is string => c != null))].sort();

  // Only offer a category the query can actually fill. Curated spots are all
  // implicitly "restaurant" (the hub never hand-curates bars or cafes), so they
  // vouch for that one chip and no other.
  const categoryKeys = new Set(queryPlaces.map((place) => place.category));
  if (queryCurated.length) categoryKeys.add('restaurant');
  const categoryChips = CATEGORY_FILTERS.filter((option) => option.key === 'all' || categoryKeys.has(option.key));

  // Never offer a control the result set cannot fill: a price tier nothing
  // matches, or a switch no kitchen here answers, is a chip that empties the
  // screen. Counted from the query pool, not the filtered one, so toggling a
  // chip can never delete the chip you just used.
  const priceTiers = PRICE_TIERS.filter((tier) => queryCurated.some((r) => r.price === tier));
  const priceCounts = new Map(priceTiers.map((tier) => [tier, queryCurated.filter((r) => r.price === tier).length]));
  const offerSwitches = OFFER_SWITCHES.filter((offer) => queryCurated.some(offer.has));

  // Curated restaurants are implicitly "restaurant" category (the hub never
  // hand-curates bars/cafes/etc.), so a non-restaurant category chip shows
  // places only — that's correct, not a bug. Cuisine matches loosely against
  // curated free-text cuisine strings ("Guerrerense Mexican" still matches
  // "Mexican") so hand-picked spots blend into the same chip instead of
  // needing their own near-duplicate chip.
  const curatedPool = (): Restaurant[] => {
    if (category !== 'all' && category !== 'restaurant') return [];
    let pool = Object.values(RESTAURANTS);
    if (cuisine) pool = pool.filter((r) => r.cuisine.toLowerCase().includes(cuisine.toLowerCase()));
    return pool;
  };

  const curatedMatches: Restaurant[] = normalizedQuery
    ? (() => {
        const matches = new Set(searchFoodHub(query, filters).map((r) => r.id));
        return curatedPool().filter((r) => matches.has(r.id));
      })()
    : filters.sort === 'Best match'
      ? sortByAffinity(applyRestaurantFilters(curatedPool(), filters), s.tasteTags, restaurantHaystack)
      : applyRestaurantFilters(curatedPool(), filters);

  const deviceLocation = usableAnchor(s.deviceLocation);
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const now = useNow(60_000);
  // Distance is the primary sort, not a filter (CLAUDE.md #2) — with a real
  // device fix everything with resolvable coordinates is ordered nearest-first
  // by default, not only when the guest hunts down the Nearest sort option.
  // Alphabetical is just the no-location fallback. 'Lowest price' still wins
  // when explicitly chosen, since that's an override the guest asked for.
  const distanceFirst = deviceLocation != null && filters.sort !== 'Lowest price';

  const placeMatches: Place[] = queryPlaces
    .filter((place) => {
      if (category !== 'all' && place.category !== category) return false;
      if (cuisine && place.cuisine !== cuisine) return false;
      return true;
    })
    .sort((a, b) =>
      distanceFirst
        ? milesBetween(deviceLocation!, { latitude: a.lat, longitude: a.lon }) - milesBetween(deviceLocation!, { latitude: b.lat, longitude: b.lon })
        : a.name.localeCompare(b.name),
    );

  /** The guest's own tag this entry matched, or nothing. Same rule Home's
   * matched picks use — first tag that lands in the entry's own text, never a
   * tag inferred from something the catalog doesn't say. */
  const tasteTagFor = (haystack: string): string | undefined =>
    s.tasteTags.find((tag) => haystack.toLowerCase().includes(tag.toLowerCase()));

  const curatedListings = curatedMatches.map((restaurant) => {
    const point = deviceLocation ? curatedCoords(restaurant) : null;
    return listingFromRestaurant(
      restaurant,
      normalizedQuery ? restaurantSearchCue(restaurant, query) : FOOD_HUB_REASON_BY_ID[restaurant.id] ?? DEALS[restaurant.id],
      point && deviceLocation ? milesBetween(deviceLocation, point) : undefined,
      tasteTagFor(restaurantHaystack(restaurant)),
    );
  });
  // A place has no price, no delivery flag and no reservation link. With one of
  // those switched on it cannot qualify, and showing it anyway would present it
  // as though it had.
  const placeListings = (restaurantOnlyFilter ? [] : placeMatches).map((place) =>
    listingFromPlace(
      place,
      deviceLocation ? milesBetween(deviceLocation, { latitude: place.lat, longitude: place.lon }) : undefined,
      tasteTagFor([place.name, place.cuisine, placeCategoryLabel(place)].filter(Boolean).join(' ')),
    ),
  );

  // One merged list ranked by real distance whenever a device fix exists —
  // curated spots and directory places compete on the same measurement instead
  // of curated always sitting on top. Entries with no resolvable coordinates
  // (curated spots the places table doesn't cover) keep their existing order at
  // the end rather than being dropped or given a guessed position. Without a
  // device fix, or under Lowest price, the previous curated-then-places order
  // stands.
  const byDistance = (a: HubListing, b: HubListing) => {
    if (a.miles == null && b.miles == null) return 0;
    if (a.miles == null) return 1;
    if (b.miles == null) return -1;
    return a.miles - b.miles;
  };
  const results: HubListing[] = showHub
    ? []
    : distanceFirst
      ? [...curatedListings, ...placeListings].sort(byDistance)
      : !normalizedQuery && filters.sort !== 'Best match'
        ? [...curatedListings, ...placeListings]
        : [...curatedListings, ...placeListings].sort((a, b) => a.name.localeCompare(b.name));
  const visibleResults = results.slice(0, RESULTS_CAP);
  const unplacedVisible = distanceFirst && visibleResults.some((listing) => listing.miles == null);

  // One title for the page, rather than a fixed "Oakland food hub" up top
  // disagreeing with a "Search matches" heading below it. Browsing the hub is
  // still the hub; everything else is named for what the guest actually asked.
  const activeCategoryLabel = CATEGORY_FILTERS.find((c) => c.key === category)?.label;
  const titleSubject = normalizedQuery
    ? query
    : cuisine ?? (category !== 'all' ? activeCategoryLabel : null) ?? 'Filtered results';
  // What the hour actually is, from the same hours the rows read. Unhydrated
  // hours mean 'unknown', never 'closed' — so an unreadable catalog produces no
  // count at all rather than a zero that looks like bad news.
  const kitchenStates = Object.values(RESTAURANTS).map((restaurant) =>
    openStateFor(curatedHours(restaurant) ?? restaurant.hours ?? null, now),
  );
  const hoursKnown = kitchenStates.some((state) => state.status !== 'unknown');
  const openNow = kitchenStates.filter((state) => state.status === 'open').length;
  const closingSoon = kitchenStates.filter(
    (state) => state.status === 'open' && state.closesInMinutes != null && state.closesInMinutes <= 60,
  ).length;

  // Browsing, the title is the hour: a number that moves through the day rather
  // than a name that never does. Without readable hours there is no number to
  // report, so it falls back to the name the rest of the app uses for this screen.
  const pageTitle = showHub
    ? hoursKnown
      ? `${openNow} ${openNow === 1 ? 'kitchen' : 'kitchens'} open`
      : 'Oakland food hub'
    : composedTitle(titleSubject, results.length);

  const hubFacts: HubFact[] = [];
  if (hoursKnown && closingSoon > 0) {
    hubFacts.push({ glyph: 'clock', label: `${closingSoon} close within the hour`, tone: 'accent' });
  }
  hubFacts.push({ glyph: 'food', label: `${Object.keys(RESTAURANTS).length + allPlaces.length} in all` });

  // Says what kind of screen this is, now that the title is the guest's own
  // words. Drawn from the categories actually present rather than the query
  // text, so "flat white" still arrives at a cup.
  const shownCategories = new Set(placeMatches.map((place) => place.category));
  const titleGlyph = showHub
    ? 'food'
    : shownCategories.size === 1 && shownCategories.has('cafe')
      ? 'coffee'
      : shownCategories.size >= 1 && [...shownCategories].every((c) => ['bar', 'pub', 'wine_bar', 'night_club'].includes(c))
        ? 'drink'
        : 'food';

  // Facts, not a sentence: each is a field this result set can answer, and
  // anything it cannot answer is simply absent (HANDOFF, "Honesty rules"). The
  // hub keeps prose, because provenance is a claim rather than a measurement.

  const nearest = visibleResults.find((listing) => listing.miles != null)?.miles;
  const pageFacts: HubFact[] = [];
  // Facts describe what is on screen; the controls above describe what the
  // query could offer. Same catalog, two different questions.
  const shownTiers = PRICE_TIERS.filter((tier) => curatedMatches.some((r) => r.price === tier));
  const phrase = pricePhrase(shownTiers);
  if (phrase) pageFacts.push({ glyph: 'dollar', label: phrase, tone: 'accent' });
  if (curatedMatches.length && curatedMatches.every((r) => r.hasDelivery)) {
    pageFacts.push({ glyph: 'bolt', label: 'all deliver' });
  }
  if (nearest != null) pageFacts.push({ glyph: 'pin', label: `nearest ${formatMiles(nearest)}` });

  // The claim itself moves to the footer beside the disclaimer already there —
  // a guest needs it once, not at the top of every arrival. The chip in the
  // header keeps it present without spending a paragraph on it.
  const provenance =
    'Restaurants, bars, and venues across Oakland and the East Bay — cross-checked between two independent open map sources, not scraped.';

  const resetDirectory = () => {
    setQuery('');
    setCategory('all');
    setCuisine(null);
    s.resetFilters();
  };

  const goListing = (listing: HubListing) => {
    if (normalizedQuery) {
      void recordRestaurantExploration({ href: listing.href, label: listing.name });
    }
    router.push(listing.href);
  };

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 30, gap: 16 }}>
        <HeaderRow title={pageTitle} glyph={titleGlyph} trailing={showHub ? <TrustChip /> : undefined} />
        <FactStrip facts={showHub ? hubFacts : pageFacts} pullUp />

        <View className="gap-y-2.5">
          <View className="flex-row items-center gap-x-2.5 rounded-full border border-sand bg-shell px-3.5 py-0.5">
            <SearchIcon size={15} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Dish, cuisine, or place"
              placeholderTextColor={colors.taupe}
              returnKeyType="search"
              className="min-w-0 flex-1 py-2.5 font-dm text-[13px] text-ink"
            />
          </View>

          <HRow gap={6}>
            <HubDropdown
              glyph="dollar"
              label={s.price ?? 'Price'}
              chosen={Boolean(s.price)}
              open={openMenu === 'price'}
              onPress={() => setOpenMenu(openMenu === 'price' ? null : 'price')}
            />
            {cuisines.length ? (
              <HubDropdown
                glyph="food"
                label={cuisine ?? 'Cuisine'}
                chosen={Boolean(cuisine)}
                open={openMenu === 'cuisine'}
                onPress={() => setOpenMenu(openMenu === 'cuisine' ? null : 'cuisine')}
              />
            ) : null}
            {offerSwitches.map((offer) => (
              <Chip key={offer.key} label={offer.label} active={s[offer.key]} onPress={() => s.toggleFlag(offer.key)} />
            ))}
            {categoryChips.length > 2
              ? categoryChips.map((option) => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    active={category === option.key}
                    onPress={() => setCategory(option.key)}
                  />
                ))
              : null}
          </HRow>

          {openMenu === 'price' ? (
            <HubMenu
              options={[
                { label: 'Any price', value: null },
                ...priceTiers.map((tier) => ({ label: tier, value: tier, count: priceCounts.get(tier) })),
              ]}
              value={s.price}
              onSelect={(value) => {
                s.setPrice(value);
                setOpenMenu(null);
              }}
            />
          ) : null}
          {openMenu === 'cuisine' ? (
            <HubMenu
              options={[{ label: 'Any cuisine', value: null }, ...cuisines.map((label) => ({ label, value: label }))]}
              value={cuisine}
              onSelect={(value) => {
                setCuisine(value);
                setOpenMenu(null);
              }}
            />
          ) : null}
        </View>

        {showHub ? (
          <View className="gap-y-5">
            {FOOD_HUB_SECTIONS.map((section) => (
              <View key={section.id} className="gap-y-2">
                <SectionHeading title={section.title} note={section.note} />
                <RaisedView className="overflow-hidden rounded-card">
                  {section.picks.map((pick, index) => {
                    const listing = listingFromRestaurant(RESTAURANTS[pick.id], pick.reason);
                    return (
                      <FoodHubRow
                        key={listing.id}
                        name={listing.name}
                        image={listing.image}
                        cue={listing.cue}
                        meta={listing.meta}
                        last={index === section.picks.length - 1}
                        onPress={() => router.push(listing.href)}
                      />
                    );
                  })}
                </RaisedView>
              </View>
            ))}
          </View>
        ) : (
          <View className="gap-y-2.5">
            <View className="flex-row items-center justify-between gap-x-3">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: openMenu === 'sort' }}
                accessibilityLabel={`Sorted by ${distanceFirst ? 'nearest first' : s.sort}. Change`}
                activeOpacity={0.7}
                onPress={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
                className="min-w-0 shrink flex-row items-center gap-x-1">
                <Text numberOfLines={1} className="font-dm-medium text-[10.5px] text-peach">
                  {distanceFirst ? 'Nearest first' : s.sort}
                </Text>
                <View style={{ transform: [{ rotate: openMenu === 'sort' ? '-90deg' : '90deg' }] }}>
                  <Glyph name="chevron" size={11} color={colors['fg-accent']} strokeWidth={2} />
                </View>
                <Text className="font-dm text-[10.5px] text-taupe">
                  · {results.length} {results.length === 1 ? 'match' : 'matches'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={resetDirectory}>
                <Text className="font-dm-medium text-meta text-peach">Clear</Text>
              </TouchableOpacity>
            </View>
            {openMenu === 'sort' ? (
              <HubMenu
                options={SORTS.map((label) => ({ label, value: label }))}
                value={s.sort}
                onSelect={(value) => {
                  s.setSort(value ?? 'Best match');
                  setOpenMenu(null);
                }}
              />
            ) : null}
            {results.length > visibleResults.length ? (
              <Text className="-mt-1.5 font-dm text-[10.5px] text-taupe">Showing first {visibleResults.length} — search to narrow it down</Text>
            ) : null}
            {unplacedVisible ? (
              <Text className="-mt-1.5 font-dm text-[10.5px] text-taupe">
                Hand-picked spots without a confirmed coordinate are listed last, with their usual downtown distance.
              </Text>
            ) : null}

            {visibleResults.length ? (
              <RaisedView className="overflow-hidden rounded-card">
                {visibleResults.map((listing, index) => (
                  <FoodHubRow
                    key={listing.id}
                    name={listing.name}
                    image={listing.image}
                    cue={listing.cue}
                    meta={listing.meta}
                    tasteTag={listing.tasteTag}
                    last={index === visibleResults.length - 1}
                    onPress={() => goListing(listing)}
                  />
                ))}
              </RaisedView>
            ) : (
              <EmptyState
                compact
                tint
                tone="subtle"
                title="No matches yet"
                message="Clear your choices to reopen the full food hub."
                actionLabel="Reset"
                onAction={resetDirectory}
              />
            )}
          </View>
        )}

        <AskVeeRow query={normalizedQuery ? query : undefined} />

        <Text className="text-center font-dm text-[10px] leading-[14px] text-taupe">
          {provenance}{'\n'}Hours, menus, and offers can change. Confirm before ordering.
        </Text>
      </ScrollView>
    </Screen>
  );
}
