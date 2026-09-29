import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { FactStrip } from '@/components/fact-strip';
import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedView } from '@/components/raised-surface';
import { SectionHeading } from '@/components/section-heading';
import { TrustChip } from '@/components/trust-chip';
import { Badge, ChevronRight, EmptyState, Icon } from '@/components/ui';
import { WhyThisTrustSurface } from '@/components/visual-depictions';
import { BUDGET_OPTIONS, type BudgetPreference, type ConciergeIntentKind } from '@/lib/concierge/enums';
import { resolveFactSubject } from '@/lib/concierge/fact';
import { answerFacts } from '@/lib/answer-facts';
import { answerShapeFor, DECLINE_REASONS } from '@/lib/concierge/router';
import { RESTAURANTS, currentEventListings, type Restaurant, type ScoperEvent } from '@/lib/data';
import { milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
import { ICON_PATHS } from '@/lib/icons';
import { hoursSummary, openStateFor } from '@/lib/hours';
import { useCuratedCoords, useCuratedHours } from '@/lib/places';
import { computeDinnerTime } from '@/lib/plan-engine';
import { useScoper } from '@/lib/store';
import { eventHaystack, profileAffinity, restaurantHaystack, type AffinityTerm } from '@/lib/taste';
import { useTasteProfile } from '@/lib/use-taste-profile';
import { useThemeColors } from '@/lib/theme';

interface Row {
  key: string;
  title: string;
  meta: string;
  score: number;
  terms: AffinityTerm[];
  href: string;
  image?: string;
  rating?: number;
  demotedReason?: string;
  statusLabel?: string;
  walkMinutes?: number | null;
  matchedTag?: string;
}

function budgetRank(price: string): number {
  const index = (BUDGET_OPTIONS as readonly string[]).indexOf(price.trim());
  return index === -1 ? Number.NaN : index;
}

export default function AnswerScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ intent?: string; q?: string; not?: string; budget?: string }>();

  const intent = (params.intent ?? 'unknown') as ConciergeIntentKind;
  const shape = answerShapeFor(intent);
  const query = params.q ?? '';
  const exclusions = useMemo(
    () => (params.not ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    [params.not],
  );
  const budget = (BUDGET_OPTIONS as readonly string[]).includes(params.budget ?? '')
    ? (params.budget as BudgetPreference)
    : null;

  const deviceLocation = usableAnchor(useScoper((s) => s.deviceLocation));
  const walkBudgetMinutes = useScoper((s) => s.walkBudgetMinutes);
  const tasteTags = useScoper((s) => s.tasteTags);
  const showToast = useScoper((s) => s.showToast);
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const baseProfile = useTasteProfile();
  const [showExcluded, setShowExcluded] = useState(false);

  // 'fact' resolves deterministically against the real catalog — no model
  // call, no hallucination risk (concierge/fact.ts). Null means the guest's
  // own sentence didn't contain a name Wayvee actually carries.
  const factSubject = useMemo(() => (shape === 'fact' ? resolveFactSubject(query) : null), [shape, query]);
  const factHoursSpec = factSubject ? curatedHours(factSubject) : null;
  const factState = useMemo(() => openStateFor(factHoursSpec, new Date()), [factHoursSpec]);
  const factSummary = useMemo(() => hoursSummary(factHoursSpec), [factHoursSpec]);

  const profile = useMemo(
    () => ({ ...baseProfile, excluded: [...baseProfile.excluded, ...exclusions] }),
    [baseProfile, exclusions],
  );

  const rows = useMemo<Row[]>(() => {
    if (shape === 'places') {
      const dinnerAt = computeDinnerTime(null, new Date());
      return Object.values(RESTAURANTS)
        .map((restaurant: Restaurant) => {
          const point = curatedCoords(restaurant);
          const minutes = deviceLocation && point ? walkMinutes(milesBetween(deviceLocation, point)) : null;
          const state = openStateFor(curatedHours(restaurant), dinnerAt);
          const overBudget = budget ? budgetRank(restaurant.price) > budgetRank(budget) : false;
          const overWalkBudget = walkBudgetMinutes != null && minutes != null && minutes > walkBudgetMinutes;

          const { score, terms } = profileAffinity(restaurantHaystack(restaurant), profile, {
            walkMinutes: minutes,
            walkBudgetMinutes,
            budgetMatches: budget ? !overBudget : null,
            budgetLabel: restaurant.price,
            openLabel: state.status === 'open' ? (state.closesAt ? `Open till ${state.closesAt}` : 'Open now') : null,
            closedLabel: state.status === 'closed' ? (state.opensAt ? `Closed · opens ${state.opensAt}` : 'Closed now') : null,
          });

          const demotedReason = overBudget
            ? `Above ${budget} — shown dimmed`
            : overWalkBudget
              ? `${minutes} min walk — past your ${walkBudgetMinutes} min budget`
              : undefined;

          const matchedTag = tasteTags.find((tag) =>
            restaurantHaystack(restaurant).toLowerCase().includes(tag.toLowerCase()),
          );

          return {
            key: restaurant.id,
            title: restaurant.name,
            meta: [restaurant.cuisine, restaurant.price].filter(Boolean).join(' · '),
            score,
            terms,
            href: `/restaurant/${restaurant.id}`,
            image: restaurant.image,
            rating: restaurant.rating,
            demotedReason,
            statusLabel: state.status === 'open' && state.closesAt ? `till ${state.closesAt}` : state.status === 'open' ? 'Open now' : undefined,
            walkMinutes: minutes,
            matchedTag,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }

    if (shape === 'events') {
      return currentEventListings()
        .map((event: ScoperEvent) => {
          const { score, terms } = profileAffinity(eventHaystack(event), profile);
          const matchedTag = tasteTags.find((tag) =>
            eventHaystack(event).toLowerCase().includes(tag.toLowerCase()),
          );
          return {
            key: event.id,
            title: event.name,
            meta: [event.venue, event.date, event.priceLabel].filter(Boolean).join(' · '),
            score,
            terms,
            href: `/event/${event.id}`,
            image: event.image,
            matchedTag,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }

    return [];
  }, [tasteTags, budget, curatedCoords, curatedHours, deviceLocation, profile, shape, walkBudgetMinutes]);

  const visible = showExcluded ? rows : rows.filter((row) => !row.demotedReason);
  const hiddenCount = rows.length - visible.length;
  const top = visible[0];

  return (
    <Screen>
      <ScreenScroll gap={16}>
        {/* The same header every pushed screen wears. What sat here was the
            bordered summary box that came off /plan two passes ago — a double
            rust border, a tinted tile, an uppercase kicker, and a divider that
            was `border-sand/60`: `sand` is already a 12% ink, and the /60
            modifier does not compose against a raw rgba, so it painted a solid
            dark rule. Under it, on a declined answer, nothing at all.
            A strip with no facts draws nothing, which is the honest shape. */}
        <HeaderRow
          title={query ? `\u201C${query}\u201D` : 'Top matches'}
          trailing={
            <TrustChip
              label="AI Concierge"
              glyph="spark"
              tone="taupe"
              hint="Answered by the concierge from the live catalog"
            />
          }
        />
        <FactStrip
          facts={answerFacts({ budget, exclusions, matchCount: visible.length })}
          pullUp
        />

        {shape === 'declined' ? (
          <View className="gap-y-3">
            <RaisedView className="rounded-2xl p-4">
              <Text className="font-fraunces text-section text-ink">Couldn&apos;t answer that yet</Text>
              <Text className="mt-1.5 font-dm text-meta text-taupe">
                {DECLINE_REASONS[intent] ?? DECLINE_REASONS.unknown}
              </Text>
            </RaisedView>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => router.replace('/(tabs)/discover')}
              className="w-full items-center rounded-full bg-ember py-3.5">
              <Text className="font-dm-bold text-label text-white">Show me what&apos;s on</Text>
            </TouchableOpacity>
          </View>
        ) : shape === 'fact' ? (
          factSubject ? (
            <View className="gap-y-3">
              <RaisedView className="gap-y-2 rounded-2xl p-4">
                <Text className="font-fraunces text-section text-ink">{factSubject.name}</Text>
                {factState.status === 'open' ? (
                  <Badge label={factState.closesAt ? `Open now · till ${factState.closesAt}` : 'Open now · 24 hours'} tone="success" />
                ) : factState.status === 'closed' ? (
                  <Badge label={factState.opensAt ? `Closed · opens ${factState.opensAt}` : 'Closed'} />
                ) : (
                  <Text className="font-dm text-meta text-taupe">Hours aren&apos;t listed — see the official site.</Text>
                )}
                {factSummary ? <Text className="font-dm text-meta text-taupe">{factSummary}</Text> : null}
                {factSubject.address ? <Text className="font-dm text-meta text-taupe">{factSubject.address}</Text> : null}
              </RaisedView>
              {factSubject.kind === 'restaurant' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => router.push(`/restaurant/${factSubject.id}`)}
                  className="w-full items-center rounded-full bg-ember py-3.5">
                  <Text className="font-dm-bold text-label text-white">View details</Text>
                </TouchableOpacity>
              ) : factSubject.sourceUrl ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(factSubject.sourceUrl!).catch(() => showToast('Could not open that link'))}
                  className="w-full items-center rounded-full bg-ember py-3.5">
                  <Text className="font-dm-bold text-label text-white">Official site</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <RaisedView className="rounded-2xl p-4">
              <Text className="font-fraunces text-section text-ink">Couldn&apos;t tell which place you meant</Text>
              <Text className="mt-1.5 font-dm text-meta text-taupe">Try naming the restaurant, bar, or venue directly.</Text>
            </RaisedView>
          )
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing matched" message="Try widening the budget or dropping a constraint." />
        ) : (
          <View className="gap-y-3">
            {/* One card, hairline dividers, no gutter — the idiom every other
                vertical list in the app already uses (the food hub, /tonight,
                a collection's picks). These were eight separate raised cards
                in a gap-y-2.5 stack: 94 pt tall on a 104 pt pitch, against
                65-85 at zero gap everywhere else, which is most of why this
                screen read as a different product. The 64 pt thumbnail was
                setting every row on its own — the text stack inside is ~56 —
                so it comes down to 56, the size the rest of the app uses.

                The #1-#8 rank pills are gone with it. An ordered list already
                states rank by position and the top row's fill already says
                which is first; the pills said both again, and indenting every
                name by a different amount cost more than they were worth. */}
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {visible.map((row, index) => (
                <TouchableOpacity
                  key={row.key}
                  accessibilityRole="link"
                  accessibilityLabel={`${index === 0 ? 'Top match. ' : ''}${row.title}. ${row.meta}`}
                  activeOpacity={0.75}
                  onPress={() => router.push(row.href)}
                  style={row.demotedReason ? { opacity: 0.6 } : undefined}
                  // The top match keeps its tint, bled to the card's edge so it
                  // reads as the first row rather than a separate object.
                  className={`flex-row items-center gap-x-3 py-3 ${
                    index < visible.length - 1 ? 'border-b border-sand' : ''
                  } ${index === 0 ? '-mx-3.5 bg-coral-50 px-3.5' : ''}`}>
                  {row.image ? <Photo uri={row.image} radius={10} style={{ width: 56, height: 56 }} /> : null}

                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center justify-between gap-x-2">
                      <Text numberOfLines={1} className="min-w-0 flex-1 font-dm-bold text-body text-ink">{row.title}</Text>
                      {row.rating ? <Text className="shrink-0 font-dm-bold text-meta text-rust">&#9733; {row.rating}</Text> : null}
                    </View>

                    <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Text numberOfLines={1} className="font-dm text-meta text-taupe">{row.meta}</Text>
                      {row.walkMinutes != null ? (
                        <Text className="font-dm-bold text-meta text-pine">&middot; {row.walkMinutes} min walk</Text>
                      ) : null}
                      {row.statusLabel ? (
                        <Text className="font-dm-medium text-meta text-pine">&middot; {row.statusLabel}</Text>
                      ) : null}
                    </View>

                    {row.matchedTag ? (
                      <View className="mt-0.5 flex-row items-center gap-x-1">
                        <Icon d={ICON_PATHS.sparkles} size={10} color={colors.rust} strokeWidth={2} />
                        <Text numberOfLines={1} className="min-w-0 flex-1 font-dm-medium text-micro text-rust">
                          Fits your taste ({row.matchedTag})
                        </Text>
                      </View>
                    ) : null}

                    {row.demotedReason ? (
                      <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-danger">{row.demotedReason}</Text>
                    ) : null}
                  </View>

                  <ChevronRight color={colors.peach} strokeWidth={1.8} />
                </TouchableOpacity>
              ))}
            </RaisedView>

            {hiddenCount > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.75}
                onPress={() => setShowExcluded(true)}
                className="items-center rounded-2xl border border-dashed border-sand px-4 py-3">
                <Text className="font-dm-medium text-meta text-taupe">
                  {hiddenCount} set aside — show {hiddenCount === 1 ? 'it' : 'them'} anyway
                </Text>
              </TouchableOpacity>
            ) : null}

            {top?.terms.length ? (
              <View className="gap-y-2 pt-3">
                <SectionHeading title="Why this order" />
                <WhyThisTrustSurface
                  title={`Why ${top.title}?`}
                  score={top.score}
                  rankText={`Ranked #1 of ${rows.length} matches off deterministic profile affinity`}
                  terms={top.terms}
                />
              </View>
            ) : null}
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}
