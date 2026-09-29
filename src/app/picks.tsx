import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedTouchable, RaisedView } from '@/components/raised-surface';
import { ChevronRight, Chip, SearchIcon } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';
import { DESTINATION_PRIORITY, sortedViatorPicks, useViatorPicks, viatorPriceLabel, type ViatorPick } from '@/lib/viator';

const PICKS_PER_SUBSECTION = 4;

type SortMode = 'best' | 'rating' | 'price';
type DurationFilter = 'half' | 'full' | 'multi';

const GLYPHS = {
  sparkle: 'M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z',
  star: 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245',
  dollar: 'M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2 M12 3v3m0 12v3',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0 M12 7v5l3 3',
  shield: 'M12 3l7 3v5c0 5 -3 8 -7 10c-4 -2 -7 -5 -7 -10v-5z M9 12l2 2l4 -4',
};

const SORT_OPTIONS: { key: SortMode; label: string; iconD: string }[] = [
  { key: 'best', label: 'Best match', iconD: GLYPHS.sparkle },
  { key: 'rating', label: 'Top rated', iconD: GLYPHS.star },
  { key: 'price', label: 'Lowest price', iconD: GLYPHS.dollar },
];

const DURATION_OPTIONS: { key: DurationFilter; label: string; iconD: string }[] = [
  { key: 'half', label: 'Half-day', iconD: GLYPHS.clock },
  { key: 'full', label: 'Full-day', iconD: GLYPHS.clock },
  { key: 'multi', label: 'Multi-day', iconD: GLYPHS.clock },
];

// Real, honest urgency signals from Viator's own flags — nothing fabricated. Only these
// two carry promo/urgency meaning; PRIVATE_TOUR/SKIP_THE_LINE etc. are feature tags, not
// a reason to spotlight a card.
const SPOTLIGHT_FLAGS: Record<string, string> = {
  LIKELY_TO_SELL_OUT: 'Likely to sell out',
  SPECIAL_OFFER: 'Special offer',
};

function spotlightLabel(pick: ViatorPick): string | null {
  const flag = pick.flags.find((f) => f in SPOTLIGHT_FLAGS);
  return flag ? SPOTLIGHT_FLAGS[flag] : null;
}

/** Which subsection a pick belongs in, within its destination — real flags only. */
function flagBucket(pick: ViatorPick): 'sellout' | 'offer' | null {
  if (pick.flags.includes('LIKELY_TO_SELL_OUT')) return 'sellout';
  if (pick.flags.includes('SPECIAL_OFFER')) return 'offer';
  return null;
}

/** Buckets Viator's formatted duration strings ("45 min", "6 hours", "3 days") — no raw
 * minutes are stored, so this parses the label rather than needing a schema change. */
function durationBucket(label: string | null): DurationFilter | null {
  if (!label) return null;
  const days = label.match(/^(\d+)\s*days?$/);
  if (days) return Number(days[1]) >= 2 ? 'multi' : 'full';
  const hours = label.match(/^([\d.]+)\s*hours?$/);
  if (hours) return Number(hours[1]) >= 5 ? 'full' : 'half';
  if (/min$/.test(label)) return 'half';
  return null;
}

function sortWithin(picks: ViatorPick[], mode: SortMode): ViatorPick[] {
  if (mode === 'rating') {
    return [...picks].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  }
  if (mode === 'price') {
    return [...picks].sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
  }
  return picks;
}

function SpotlightTag({ label }: { label: string }) {
  return (
    <View className="absolute left-2 top-2 rounded-full bg-rust px-2 py-[3px]">
      <Text className="font-dm-bold text-[8px] tracking-[0.4px] text-white">{label.toUpperCase()}</Text>
    </View>
  );
}

function FeaturedPickCard({ pick, onPress }: { pick: ViatorPick; onPress: () => void }) {
  const price = viatorPriceLabel(pick);
  const spotlight = spotlightLabel(pick);
  const restLine = [pick.durationLabel, pick.rating ? `${pick.rating.toFixed(1)}★${pick.reviewCount ? ` (${pick.reviewCount})` : ''}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <RaisedTouchable
      accessibilityRole="button"
      accessibilityLabel={`Open ${pick.title}`}
      activeOpacity={0.85}
      onPress={onPress}
      className="overflow-hidden rounded-card">
      <View style={{ position: 'relative' }}>
        <Photo uri={pick.image} radius={0} style={{ width: '100%', height: 119 }} />
        {spotlight ? <SpotlightTag label={spotlight} /> : null}
      </View>
      <View className="gap-y-1 px-4 py-3">
        <Text numberOfLines={2} className="font-fraunces text-[17px] leading-[21px] text-ink">{pick.title}</Text>
        {price || restLine ? (
          <Text numberOfLines={1} className="font-dm text-label text-taupe">
            {price ? <Text className="font-dm-bold text-ink">{price}</Text> : null}
            {price && restLine ? ' · ' : ''}
            {restLine}
          </Text>
        ) : null}
      </View>
    </RaisedTouchable>
  );
}

function PickRow({ pick, onPress }: { pick: ViatorPick; onPress: () => void }) {
  const price = viatorPriceLabel(pick);
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${pick.title}`}
      activeOpacity={0.72}
      onPress={onPress}
      className="flex-row items-center gap-x-3 border-b border-sand py-3 last:border-b-0">
      <Photo uri={pick.image} radius={10} style={{ width: 56, height: 56 }} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={2} className="font-dm-bold text-[13.5px] leading-[17px] text-ink">{pick.title}</Text>
        <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
          {[price, pick.durationLabel, pick.rating ? `${pick.rating.toFixed(1)}★` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <ChevronRight color={colors.peach} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

function PickList({ picks, onOpen }: { picks: ViatorPick[]; onOpen: (id: string) => void }) {
  if (!picks.length) return null;
  return (
    <RaisedView className="overflow-hidden rounded-card px-3.5">
      {picks.map((pick) => (
        <PickRow key={pick.id} pick={pick} onPress={() => onOpen(pick.id)} />
      ))}
    </RaisedView>
  );
}

const SCREEN_GUTTER = 20;

export default function PicksScreen() {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [durationFilter, setDurationFilter] = useState<DurationFilter | null>(null);
  const [freeCancellationOnly, setFreeCancellationOnly] = useState(false);
  const [query, setQuery] = useState('');
  const colors = useThemeColors();

  const hydratedViatorPicks = useViatorPicks();
  const allPicks = sortedViatorPicks(hydratedViatorPicks);
  const q = query.trim().toLowerCase();
  const filtered = allPicks.filter((pick) => {
    if (q) {
      const searchable = `${pick.title} ${pick.description} ${pick.destination}`.toLowerCase();
      if (!q.split(' ').filter(Boolean).every((token) => searchable.includes(token))) return false;
    }
    if (freeCancellationOnly && !pick.freeCancellation) return false;
    if (durationFilter && durationBucket(pick.durationLabel) !== durationFilter) return false;
    return true;
  });

  const groups: { destination: string; picks: ViatorPick[] }[] = DESTINATION_PRIORITY
    .map((destination) => ({ destination, picks: sortWithin(filtered.filter((p) => p.destination === destination), sortMode) }))
    .filter((group) => group.picks.length > 0);
  const other = filtered.filter((p) => !(DESTINATION_PRIORITY as readonly string[]).includes(p.destination));
  if (other.length) groups.push({ destination: 'More nearby', picks: sortWithin(other, sortMode) });

  const hasAnyPicks = allPicks.length > 0;

  return (
    <Screen>
      <ScreenScroll gap={18}>
        <HeaderRow title="Picks for your stay" />

        {hasAnyPicks ? (
          <>
            <View className="flex-row items-center gap-x-2.5 rounded-card border border-sand bg-shell px-4 py-2.5 shadow-2xs">
              <SearchIcon size={15} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search picks"
                placeholderTextColor={colors.taupe}
                className="min-w-0 flex-1 font-dm text-[13px] text-ink"
                style={{ paddingVertical: 0 }}
              />
            </View>

            <View style={{ marginHorizontal: -SCREEN_GUTTER }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, gap: 8, alignItems: 'center' }}>
                {SORT_OPTIONS.map((option) => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    iconD={option.iconD}
                    active={sortMode === option.key}
                    onPress={() => setSortMode(option.key)}
                  />
                ))}
                <View style={{ width: 1, height: 22 }} className="bg-sand" />
                {DURATION_OPTIONS.map((option) => (
                  <Chip
                    key={option.key}
                    label={option.label}
                    iconD={option.iconD}
                    active={durationFilter === option.key}
                    onPress={() => setDurationFilter((current) => (current === option.key ? null : option.key))}
                  />
                ))}
                <Chip
                  label="Free cancellation"
                  iconD={GLYPHS.shield}
                  active={freeCancellationOnly}
                  onPress={() => setFreeCancellationOnly((value) => !value)}
                />
              </ScrollView>
            </View>
          </>
        ) : null}

        {groups.length ? (
          groups.map((group) => {
            const [featured, ...rest] = group.picks;
            const openPick = (id: string) => router.push(`/pick/${id}`);
            const sellout = rest.filter((p) => flagBucket(p) === 'sellout').slice(0, PICKS_PER_SUBSECTION);
            const offers = rest.filter((p) => flagBucket(p) === 'offer').slice(0, PICKS_PER_SUBSECTION);
            const rest2 = rest.filter((p) => flagBucket(p) === null).slice(0, PICKS_PER_SUBSECTION);
            return (
              <View key={group.destination} className="gap-y-3">
                <Text className="font-fraunces text-[19px] text-ink">{group.destination}</Text>
                <FeaturedPickCard pick={featured} onPress={() => openPick(featured.id)} />
                {sellout.length ? (
                  <View className="gap-y-2">
                    <Text className="font-dm-bold text-[13px] text-rust">Likely to sell out</Text>
                    <PickList picks={sellout} onOpen={openPick} />
                  </View>
                ) : null}
                {offers.length ? (
                  <View className="gap-y-2">
                    <Text className="font-dm-bold text-[13px] text-rust">Special offers</Text>
                    <PickList picks={offers} onOpen={openPick} />
                  </View>
                ) : null}
                <PickList picks={rest2} onOpen={openPick} />
              </View>
            );
          })
        ) : (
          <RaisedView className="items-center rounded-card px-4 py-8">
            <Text className="font-dm-medium text-[13.5px] text-ink">
              {hasAnyPicks ? 'No picks match your filters' : 'No picks synced yet'}
            </Text>
            <Text className="mt-1 text-center font-dm text-label text-taupe">
              {hasAnyPicks ? 'Try clearing a filter or searching something else.' : 'Check back soon — this list refreshes automatically.'}
            </Text>
          </RaisedView>
        )}
      </ScreenScroll>
    </Screen>
  );
}
