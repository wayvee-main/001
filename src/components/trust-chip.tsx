import { Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { useThemeColors } from '@/lib/theme';

/** "Cross-checked" as a chip rather than a paragraph.
 *
 * The hub used to spend three lines at the top of every visit explaining that
 * its places are confirmed against two independent open map sources and never
 * scraped. That is a real claim about the data and the one thing here a
 * competitor cannot copy — but it is a claim a guest needs once, not on every
 * arrival. This carries it in a chip; the full sentence lives in the footer,
 * beside the disclaimer that was always down there. */
export function TrustChip({
  label = 'Cross-checked',
  glyph = 'shield',
  hint = 'Cross-checked between two independent open map sources',
  tone = 'pine',
}: {
  label?: string;
  glyph?: string;
  /** What a screen reader hears — the full claim the chip abbreviates. */
  hint?: string;
  /** 'pine' is the verified/green claim. 'taupe' is a claim that is true but
   * not a good-news one, e.g. a plan that had to relax a constraint. */
  tone?: 'pine' | 'taupe';
} = {}) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={hint}
      style={{ backgroundColor: tone === 'pine' ? colors.sage : colors.surface }}
      className="shrink-0 flex-row items-center gap-x-1 rounded-full px-2.5 py-1">
      <Glyph name={glyph} size={11} color={tone === 'pine' ? colors.pine : colors.taupe} strokeWidth={1.9} />
      <Text className={`font-dm-medium text-[10px] ${tone === 'pine' ? 'text-pine' : 'text-taupe'}`}>{label}</Text>
    </View>
  );
}
