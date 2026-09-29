// Rows that open in place.
//
// These replaced the Menu/About tab bars on the detail screens. A tab bar
// hides half a screen behind a control that says nothing about what is behind
// it, and it can only ever hold two things; a stack of rows says what each one
// is and how much is in it, and adding a third costs nothing.
//
// They live here rather than inside detail-screen.tsx because the plan screens
// want them too — "Why these picks" and "What Vee assumed" are the same kind
// of thing as "Good to know", and a screen scaffold is the wrong place to
// import a row from.

import { useState, type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { RaisedView } from '@/components/raised-surface';
import { Icon } from '@/components/ui';
import { WhyThisTrustSurface } from '@/components/visual-depictions';
import type { AffinityTerm } from '@/lib/taste';
import { useThemeColors } from '@/lib/theme';

const CHEVRON_DOWN = 'M6 9l6 6l6 -6';

export interface DetailDisclosure {
  key: string;
  glyph: string;
  label: string;
  /** One line of what is inside, shown while the row is closed. */
  summary?: string;
  /** Right-aligned value, e.g. a count or a score. */
  value?: string;
  children: ReactNode;
}

/** A row that opens in place.
 *
 * These replaced the Menu/About tab bars. A tab bar hides half a screen behind
 * a control that says nothing about what is behind it, and it can only ever
 * hold two things; a stack of rows says what each one is and how much is in
 * it, and adding a third costs nothing. Open state is per-row and local — the
 * page does not remember it, because a guest coming back to a restaurant is
 * asking the top of the page, not the bottom. */
function DisclosureRow({
  row,
  divider,
}: {
  row: DetailDisclosure;
  divider: boolean;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <View className={divider && !open ? 'border-b border-sand' : ''}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={row.summary ? `${row.label}, ${row.summary}` : row.label}
        activeOpacity={0.7}
        onPress={() => setOpen((was) => !was)}
        className="flex-row items-center gap-x-3 py-3">
        <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface">
          <Glyph name={row.glyph} size={15} color={colors.peach} strokeWidth={1.8} />
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-dm-medium text-body text-ink">{row.label}</Text>
          {row.summary ? (
            <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{row.summary}</Text>
          ) : null}
        </View>
        {row.value ? <Text className="shrink-0 font-dm text-meta text-taupe">{row.value}</Text> : null}
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon d={CHEVRON_DOWN} size={15} color={colors.taupe} strokeWidth={1.9} />
        </View>
      </TouchableOpacity>
      {open ? (
        <View className={`pb-3.5 ${divider ? 'border-b border-sand' : ''}`}>{row.children}</View>
      ) : null}
    </View>
  );
}

/** The trust surface as a fold. It is the tallest block on any detail screen
 * and the least urgent — a guest who already decided does not need the score
 * broken down — so it folds like everything else that is not the answer. The
 * score stays visible on the closed row, because that part is the summary. */
export function whyRow(
  subject: string,
  affinity: { score: number; terms: AffinityTerm[] } | null | undefined,
): DetailDisclosure[] {
  if (!affinity?.terms.length) return [];
  const positives = affinity.terms.filter((term) => term.isPositive).length;
  return [{
    key: 'why',
    glyph: 'spark',
    label: `Why ${subject}`,
    summary: `${positives} of your tastes matched`,
    value: affinity.score.toFixed(1),
    children: <WhyThisTrustSurface title={`Why ${subject}?`} score={affinity.score} terms={affinity.terms} />,
  }];
}

export function DetailDisclosureGroup({ rows }: { rows: DetailDisclosure[] }) {
  if (!rows.length) return null;
  return (
    <RaisedView className="overflow-hidden rounded-card px-3.5">
      {rows.map((row, index) => (
        <DisclosureRow key={row.key} row={row} divider={index < rows.length - 1} />
      ))}
    </RaisedView>
  );
}
