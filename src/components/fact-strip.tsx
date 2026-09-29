import { Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { useThemeColors } from '@/lib/theme';

/** One thing a screen's subject is, said in a glyph and a value. `accent` is
 * spent on price and nothing else; `open` is reserved for liveness, the same
 * way the open-now green is everywhere else. */
export type HubFact = { glyph: string; label: string; tone?: 'accent' | 'open' };

/** The line under a title, in the language Home's counts trail already speaks.
 * Deliberately one line: it exists to say what the title cannot, and a strip
 * long enough to wrap is a strip that has stopped being a summary. The last
 * fact ellipsizes rather than pushing its neighbours off the screen.
 *
 * This is also the detail screens' fact slot. It replaced a four-tile row there
 * whose cells were a quarter of the screen wide and clipped their own values —
 * "10:00 PM" does not fit 60 pt of `text-label`, never mind "10-course dinner".
 * A strip has no per-cell budget to overrun.
 *
 * `pullUp` is the food hub's and See-all's tighter spacing under a title block;
 * it is not the default, because a strip sitting in a gapped stack wants the
 * gap it was given. */
export function FactStrip({ facts, pullUp = false }: { facts: HubFact[]; pullUp?: boolean }) {
  const colors = useThemeColors();
  if (!facts.length) return null;
  const toneColor = (tone: HubFact['tone']) =>
    tone === 'accent' ? colors.rust : tone === 'open' ? colors.pine : colors['fg-muted'];
  return (
    <View className={`flex-row items-center ${pullUp ? '-mt-1.5' : ''}`}>
      {facts.map((fact, index) => (
        <View key={`${fact.glyph}-${fact.label}`} className="min-w-0 shrink flex-row items-center">
          {index ? <View className="mx-2 h-[3px] w-[3px] shrink-0 rounded-full bg-fg-muted opacity-40" /> : null}
          <View className="min-w-0 shrink flex-row items-center gap-x-1.5">
            <Glyph name={fact.glyph} size={13} color={toneColor(fact.tone)} strokeWidth={1.8} />
            <Text numberOfLines={1} className="shrink font-dm-medium text-meta text-ink">{fact.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
