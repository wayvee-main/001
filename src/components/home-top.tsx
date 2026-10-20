import type { ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { Glyph } from '@/components/glyph';
import { VeeMark } from '@/components/vee-mark';
import { WayveeWordmark } from '@/components/wayvee-wordmark';
import type { HomeSuggestion } from '@/lib/daypart';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
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

/** Brand and live weather above Home. The selected city lives inside search. */
export function HomeHeader({
  hasReminders,
  onNotifications,
  onProfile,
}: {
  hasReminders: boolean;
  onNotifications: () => void;
  onProfile: () => void;
}) {
  const colors = useThemeColors(), control = useControlSurface();
  const weather = useWeatherNow();
  return (
    <View testID="home-header" style={{ paddingTop: 10 }} className="flex-row items-start justify-between gap-x-3">
      <View className="min-w-0 flex-1">
        <WayveeWordmark size={26} />
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
          style={control}
          onPress={onNotifications}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-raised border border-edge-faint shadow-soft-light dark:shadow-soft-dark">
          <Glyph name="bell" size={18} color={colors.fg} strokeWidth={1.55} />
          {hasReminders ? (
            <View
              style={{ borderColor: colors.bg }}
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 bg-rust"
            />
          ) : null}
        </TouchableOpacity>
        {/* A glyph rather than an initial on a yellow disc. It sits beside the
            bell, and two actions in the same corner reading as two different
            kinds of control was the whole of the noise. */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Your Wayvee profile"
          activeOpacity={0.78}
          style={control}
          onPress={onProfile}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-raised border border-edge-faint shadow-soft-light dark:shadow-soft-dark">
          <Glyph name="user" size={19} color={colors.fg} strokeWidth={1.55} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** A softly rounded ribbon in the same raised paper as Collections. */
export function HomeEveningRibbon({onPress}:{onPress:()=>void}) {
  const colors=useThemeColors(),surface=useRaisedSurface(1);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open your evening with Vee" activeOpacity={.78}
    onPress={onPress} testID="home-evening-ribbon"
    style={[surface,{minHeight:61.2,borderRadius:22,flexDirection:'row',alignItems:'stretch'}]}>
    <View className="min-w-0 flex-1 flex-row items-center" style={{paddingHorizontal:11,paddingVertical:8.4,gap:7}}>
      <VeeMark size={28.9} color={colors['surface-accent']} />
      <View className="min-w-0 flex-1"><Text numberOfLines={1} className="font-fraunces text-ink" style={{fontSize:15.3,lineHeight:18}}>Your evening, with Vee</Text>
        <Text className="mt-0.5 font-dm text-fine text-taupe">A little more city.</Text></View>
    </View>
    <View className="items-center justify-center" style={{width:44}}><Glyph name="arrow" size={16} color={colors['surface-accent']} /></View>
  </TouchableOpacity>;
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
  /** Omitted on Home, which names the city in search and opens
   * straight into the ask bar. */
  title?: string;
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
  const launcherSurface = useRaisedSurface(1);

  return (
    <View
      style={embedded ? undefined : lift}
      className={embedded ? '' : 'gap-y-3 rounded-sheet bg-surface-soft px-4 pb-3.5 pt-4'}>
      {title ? (
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
      ) : null}

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
            marginTop: embedded && title ? 14 : undefined,
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
            className="h-9 shrink-0 flex-row items-center gap-x-1.5 rounded-full border border-dashed border-fg-muted px-3 shadow-soft-light dark:shadow-soft-dark">
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
              style={[launcherSurface, { backgroundColor: colors['surface-raised'], borderColor: colors['edge-faint'] }]}
              className="h-9 shrink-0 flex-row items-center gap-x-1.5 rounded-full border px-3 border-edge-faint shadow-soft-light dark:shadow-soft-dark">
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
