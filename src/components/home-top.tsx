import { type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { VeeMark } from '@/components/vee-mark';
import { Glyph } from '@/components/glyph';
import type { HomeSuggestion } from '@/lib/daypart';
import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';
import { useWeatherNow, weatherLine } from '@/lib/weather';

/**
 * Home's opening region, from the approved reference build: the day-and-place
 * header, Vee's hero, Vee's pick, and the stay anchor.
 *
 * It lives apart from the screen because the boundary is real — everything
 * below the unified concierge panel is Wayvee's established Home, carried
 * over as it was and wearing the new palette.
 */

/** Lift for the soft tier, kept deliberately below the card elevation used
 * elsewhere: this run should sit above the page, not float over it.
 *
 * The tier barely separates by fill — 1.04:1 against the paper in light — so a
 * hairline edge draws the boundary in both themes, and light adds the faintest
 * drop on top of it. Dark takes the edge alone: the ground there is already
 * near-black, so a shadow has almost nothing left to darken, and the rim is the
 * honest cue. */
export function useSoftLift(): ViewStyle {
  return useRaisedSurface(1);
}

/** A transparent layout boundary for Home's opening actions. */
export function HomeVeePanel({ children }: { children: ReactNode }) {
  return <View className="gap-y-3">{children}</View>;
}

/** Where you are, what it is doing outside, and app-level actions.
 *
 * The mark stands alone here without the word beside it. At this size the
 * lockup was mostly lettering, and the app's name is not what a guest opening
 * Home needs to read — where they are and what the weather is doing are.
 *
 * Weather is read here rather than passed in, so both screens that mount this
 * header get it without threading a prop through either. It renders only when
 * a period actually covers now: weatherAt returns null otherwise, and a stale
 * reading is worse than none (see lib/weather.ts). */
export function HomeHeader({
  locationLabel,
  initial,
  hasReminders,
  onNotifications,
  onProfile,
}: {
  locationLabel: string;
  initial: string;
  hasReminders: boolean;
  onNotifications: () => void;
  onProfile: () => void;
}) {
  const colors = useThemeColors();
  const weather = useWeatherNow();
  return (
    <View style={{ paddingTop: 10 }} className="flex-row items-start justify-between gap-x-3">
      <View className="min-w-0 flex-1">
        {/* Mark and place on one line: together they answer "where am I", and
            stacking them made two weak rows out of one strong one.

            16px mark against 14px type. Matching the numbers exactly reads
            smaller than it measures — the glyph does not fill its box the way
            a capital fills its em — so the mark is sized to sit optically
            level with the type rather than numerically equal to it. */}
        <View className="flex-row items-center gap-x-1.5">
          {/* The lockup carried the brand's accessible name; the bare mark has
              none of its own, so it is labelled here. */}
          <View accessible accessibilityRole="image" accessibilityLabel="Wayvee">
            <VeeMark size={16} variant="compact" />
          </View>
          {/* shrink, so a long place name truncates instead of shouldering the
              mark out of the row. */}
          <Text numberOfLines={1} className="shrink font-dm-bold text-body text-ink">
            {locationLabel}
          </Text>
        </View>
        {/* Its own line rather than appended to the location: at 360dp the two
            together overflow once the forecast adds a rain chance, and a single
            clipped line would drop the weather entirely. */}
        {weather ? (
          <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
            {weatherLine(weather)}
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center gap-x-1">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          activeOpacity={0.72}
          onPress={onNotifications}
          className="h-9 w-9 items-center justify-center rounded-full">
          <Glyph name="bell" size={18} color={colors.fg} strokeWidth={1.55} />
          {hasReminders ? (
            <View
              style={{ borderColor: colors.bg }}
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 bg-rust"
            />
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Your Wayvee profile"
          activeOpacity={0.78}
          onPress={onProfile}
          className="h-9 w-9 items-center justify-center rounded-full bg-warm">
          <Text style={{ color: colors['warm-strong'] }} className="font-dm-bold text-label">{initial}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Vee's own block: one question, a stable launcher, and time-aware discovery
 * suggestions. The launcher deliberately does not cycle: changing copy under
 * a guest's finger made the primary action feel unsettled. */
export function VeeHero({
  title,
  suggestions,
  askPrompt,
  stayLabel,
  onSuggestion,
  onStay,
  onAsk,
  embedded = false,
}: {
  title: string;
  suggestions: HomeSuggestion[];
  askPrompt: string;
  stayLabel: string;
  onSuggestion: (suggestion: HomeSuggestion) => void;
  onStay: () => void;
  onAsk: () => void;
  embedded?: boolean;
}) {
  const colors = useThemeColors();
  const lift = useSoftLift();
  const launcherSurface = useRaisedSurface(2);

  return (
    <View
      style={embedded ? undefined : lift}
      className={embedded ? '' : 'gap-y-3 rounded-sheet bg-surface-soft px-4 pb-3.5 pt-4'}>
      <View>
        {/* One line, always. The titles are written to four words (daypart.ts
            enforces it in test), and this caps the damage if one ever grows:
            it truncates visibly instead of silently reflowing to three lines
            and pushing the search bar down the screen. */}
        <Text
          numberOfLines={1}
          className={embedded ? 'font-fraunces-medium text-display text-ink' : 'font-fraunces-medium text-title text-ink'}>
          {title}
        </Text>
      </View>

      {/* Always present. This is the screen's primary input, and it is a search
          bar in the plain sense — it opens the search overlay, which owns
          type-ahead, recent searches and results. It does not reach the
          concierge; that lives on the Plans tab, and inside search as an
          "Ask Vee instead" row for when a query finds nothing. */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Search places, dishes and shows. ${askPrompt}`}
        activeOpacity={0.78}
        onPress={onAsk}
        style={[
          launcherSurface,
          {
            height: embedded ? 56 : 48,
            marginTop: embedded ? 14 : undefined,
          },
        ]}
        className={
          embedded
            ? 'flex-row items-center justify-between rounded-full pl-4 pr-2'
            : 'mt-0.5 flex-row items-center justify-between rounded-full pl-3.5 pr-1.5'
        }>
        <View className="min-w-0 flex-1 flex-row items-center gap-x-3">
          <Glyph name="search" size={embedded ? 22 : 19} color={colors['fg-muted']} strokeWidth={1.6} />
          <Text numberOfLines={1} className="shrink font-dm text-body text-taupe">{askPrompt}</Text>
        </View>
        <View
          className={
            embedded
              ? 'h-10 w-10 items-center justify-center rounded-full bg-ember'
              : 'h-[38px] w-[38px] items-center justify-center rounded-full bg-ember'
          }>
          <Glyph name="arrow" size={18} color={colors['on-accent']} strokeWidth={1.8} />
        </View>
      </TouchableOpacity>

      {suggestions.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 2 }}
          className="mt-3">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={stayLabel}
            activeOpacity={0.74}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={onStay}
            // Marigold tint rather than full-strength marigold: this was the only
            // saturated fill on Home and pulled harder than the search bar above
            // it, for a secondary action. The dashed line is the same idiom the
            // empty states use (plan.tsx, profile.tsx, answer.tsx) and means the
            // same thing here — a slot with nothing in it yet — which is what
            // separates this chip from the searches beside it. It runs at
            // fg-muted rather than the usual edge because "more distinct" is the
            // point; marigold can't do it, at 1.41:1 on its own tint in light.
            //
            // Lettering is fg, the pairing check already tracks against this
            // block (scripts/check-contrast.ts). It is NOT warm-strong: that is
            // ink for a marigold *fill*, so it darkens in dark mode exactly as
            // warm-tint does, and the two collapsed to 1.08:1 against each other.
            style={{ backgroundColor: colors['warm-tint'] }}
            className="h-9 shrink-0 flex-row items-center gap-x-1.5 rounded-full border border-dashed border-fg-muted px-3">
            <Glyph name="luggage" size={13} color={colors['fg-muted']} strokeWidth={1.9} />
            <Text numberOfLines={1} className="font-dm-medium text-label text-ink">
              {stayLabel}
            </Text>
          </TouchableOpacity>
          {suggestions.map((suggestion) => (
            <TouchableOpacity
              key={`${suggestion.destination}-${suggestion.label}-${suggestion.query}`}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${suggestion.label}`}
              activeOpacity={0.72}
              hitSlop={{ top: 4, bottom: 4 }}
              onPress={() => onSuggestion(suggestion)}
              style={[launcherSurface, { backgroundColor: colors['surface-raised'], borderColor: colors['edge-soft'] }]}
              className="h-9 shrink-0 flex-row items-center gap-x-1.5 rounded-full border px-3">
              <Glyph name={suggestion.glyph} size={13} color={colors['fg-muted']} strokeWidth={1.8} />
              <Text numberOfLines={1} className="font-dm-medium text-label text-ink">{suggestion.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Live counts, as a breadcrumb trail rather than a row of pills — every number
 * here is recomputed from the same ranked pools the sections below render, so
 * the trail can never claim more than the screen can show. */
export type TrailItem = { glyph: string; label: string; onPress?: () => void };

export function LiveTrail({ items, onSeeAll }: { items: TrailItem[]; onSeeAll: () => void }) {
  const colors = useThemeColors();
  if (!items.length) return null;
  return (
    <View className="flex-row items-center gap-x-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', gap: 8 }}
        className="min-w-0 flex-1">
        {items.map((item, index) => (
          <View key={item.label} className="flex-row items-center gap-x-2">
            {index > 0 ? <View className="h-[3px] w-[3px] rounded-full bg-sand" /> : null}
            {/* A count that cannot be followed is just decoration. Each one
                leads to the pool it counted — the tap target is the whole
                glyph-and-number pair, with hitSlop for the height the text
                alone does not have. */}
            <TouchableOpacity
              accessibilityRole={item.onPress ? 'button' : 'text'}
              accessibilityLabel={item.onPress ? `${item.label}. See them` : item.label}
              disabled={!item.onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={item.onPress}
              className="flex-row items-center gap-x-1">
              <Glyph name={item.glyph} size={13} color={colors['fg-muted']} strokeWidth={1.5} />
              <Text numberOfLines={1} className="font-dm-medium text-meta text-taupe">{item.label}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="See all discovery options"
        activeOpacity={0.72}
        onPress={onSeeAll}
        className="shrink-0 py-1">
        <Text className="font-dm-bold text-meta text-peach">See all</Text>
      </TouchableOpacity>
    </View>
  );
}
