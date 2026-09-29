// The one shape behind every detail screen.
//
// There were five: restaurant, event, venue, night and collection, each drawn
// separately and all of them older than the redesign that produced
// SectionHeading, FactStrip and SeeAllScreen. Between them they carried 42
// hard-coded type sizes across 14 distinct values, against an eight-step
// scale, and none of the five used SectionHeading.
//
// Five layouts is also why the same fact appeared three times on one page: an
// open state was a green row AND a tile AND a week strip because there were
// three places willing to hold it. Here there is one slot per fact, in a fixed
// order, so a duplicate has nowhere to go:
//
//   1 hero        photo, back, up to two icon actions
//   2 identity    name · rating · meta · address
//   3 live        one line, or nothing — never a stale one
//   4 facts       the FactStrip the food hub already speaks
//   5 sections    SectionHeading + content, in the order given
//   6 provenance  source link and Why-this, always last
//
// Every slot is optional. A nightlife spot has no live state and no facts; a
// collection has no sticky actions. Passing nothing renders nothing — that is
// the honesty rule (CLAUDE.md) expressed as a component: an absent value
// produces an absent block, never a placeholder or a dash.

import type { ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { DetailBottomNav } from '@/components/bottom-nav';
import { DetailSheet, ImmersiveDetailHero, SourceLink } from '@/components/detail';
import { DetailDisclosureGroup, type DetailDisclosure } from '@/components/disclosure-rows';
import { FactStrip, type HubFact } from '@/components/fact-strip';
import { Glyph } from '@/components/glyph';
import { AppBackdrop } from '@/components/layout';
import { SectionHeading } from '@/components/section-heading';
import { Icon } from '@/components/ui';
import { LiveStatusRow } from '@/components/visual-depictions';
import type { LiveLine } from '@/lib/detail-facts';
import { useThemeColors } from '@/lib/theme';

export { DetailDisclosureGroup, whyRow, type DetailDisclosure } from '@/components/disclosure-rows';
const STAR = 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';

export interface DetailScreenAction {
  label: string;
  iconD: string;
  onPress: () => void;
}

export interface DetailSection {
  key: string;
  /** Omit for a block that already carries its own header — the daylight bar
   * and the run-of-show rail both draw one, and a SectionHeading above them
   * would be the second title on the same card. */
  title?: string;
  /** Right-hand link on the heading, e.g. "All nights". */
  action?: string;
  onAction?: () => void;
  /** Right-hand label when the heading is only telling you something. */
  note?: string;
  /** Quiet line under the block, e.g. where the walk times were measured from. */
  footnote?: string;
  children: ReactNode;
}

export function DetailScreen({
  image,
  heroActions,
  title,
  rating,
  meta,
  address,
  onAddress,
  lede,
  live,
  facts,
  sections = [],
  rows = [],
  sourceUrl,
  sourceLabel,
  sourceNote,
  actions = [],
  navActive = 'home',
}: {
  image?: string;
  /** At most two — the hero is not a toolbar. */
  heroActions?: ReactNode;
  title: string;
  rating?: number;
  meta?: string;
  address?: string;
  onAddress?: () => void;
  /** One sentence saying what this place or night actually is. */
  lede?: string;
  live?: LiveLine | null;
  facts?: HubFact[];
  sections?: DetailSection[];
  rows?: DetailDisclosure[];
  sourceUrl?: string;
  sourceLabel?: string;
  /** Prose provenance for a screen whose subject has no single official URL —
   * a curated shortlist is assembled from several, so it says where rather
   * than linking to one. */
  sourceNote?: string;
  actions?: DetailScreenAction[];
  navActive?: 'home' | 'discover' | 'create' | 'profile';
}) {
  const colors = useThemeColors();

  return (
    <AppBackdrop>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        // No paddingBottom here: it would sit below the sheet and show the
        // backdrop through it. The sheet carries its own bottom padding, so the
        // cream runs all the way to the action bar.
        contentContainerStyle={{ flexGrow: 1 }}>
        <ImmersiveDetailHero image={image} actions={heroActions} />

        <DetailSheet fill>
          <View className="gap-y-2">
            <View className="flex-row items-start justify-between gap-x-3">
              <Text className="min-w-0 flex-1 font-fraunces text-title text-ink">{title}</Text>
              {typeof rating === 'number' ? (
                <View className="flex-row items-center gap-x-1 pt-1.5">
                  <Icon d={STAR} size={13} color={colors.peach} fill={colors.peach} strokeWidth={1} />
                  <Text className="font-dm-bold text-label text-ink">{rating}</Text>
                </View>
              ) : null}
            </View>
            {meta ? <Text numberOfLines={1} className="font-dm text-label text-taupe">{meta}</Text> : null}
            {address ? (
              <TouchableOpacity
                accessibilityRole={onAddress ? 'button' : undefined}
                accessibilityLabel={onAddress ? `Directions to ${address}` : address}
                disabled={!onAddress}
                activeOpacity={0.7}
                onPress={onAddress}
                className="flex-row items-center gap-x-1.5">
                <Glyph name="pin" size={13} color={colors.peach} strokeWidth={1.8} />
                <Text numberOfLines={1} className="min-w-0 flex-1 font-dm text-label text-ink">{address}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {live ? <LiveStatusRow tone={live.tone} label={live.label} note={live.note} /> : null}

          {facts?.length ? <FactStrip facts={facts} /> : null}

          {/* text-label, not text-body: this is the sentence that says what the
              subject is, and it sits directly under an address line of the same
              size, so the two read as one block of supporting prose rather than
              as a paragraph competing with the name. The token carries its own
              16 px leading — no hand-rolled line height. */}
          {lede ? <Text className="font-dm text-label text-ink">{lede}</Text> : null}

          {sections.map((section) => (
            <View key={section.key} className="gap-y-2.5">
              {section.title ? (
                <SectionHeading
                  title={section.title}
                  action={section.action}
                  onPress={section.onAction}
                  note={section.note}
                />
              ) : null}
              {section.children}
              {section.footnote ? (
                <Text className="font-dm text-micro text-taupe">{section.footnote}</Text>
              ) : null}
            </View>
          ))}

          <DetailDisclosureGroup rows={rows} />

          {sourceUrl ? <SourceLink url={sourceUrl} label={sourceLabel} /> : null}

          {sourceNote ? (
            <Text className="text-center font-dm text-micro leading-[16px] text-taupe">{sourceNote}</Text>
          ) : null}
        </DetailSheet>
      </ScrollView>

      {actions.length ? (
        <View className="border-t border-sand bg-cream px-5 py-3">
          <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }} className="flex-row gap-x-2">
            {actions.map((action, index) => (
              <TouchableOpacity
                key={action.label}
                accessibilityRole="button"
                activeOpacity={0.75}
                onPress={action.onPress}
                className={`h-12 min-w-0 flex-1 flex-row items-center justify-center gap-x-1.5 rounded-full ${
                  index === 0 ? 'bg-ember' : 'border border-sand bg-shell'
                }`}>
                <Icon d={action.iconD} size={15} color={index === 0 ? '#FFFFFF' : colors.ink} strokeWidth={1.9} />
                <Text numberOfLines={1} className={`font-dm-medium text-label ${index === 0 ? 'text-white' : 'text-ink'}`}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
      <DetailBottomNav active={navActive} />
    </AppBackdrop>
  );
}
