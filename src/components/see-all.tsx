import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { FactStrip, type HubFact } from '@/components/featured';
import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';

/**
 * The shape every "see all" screen shares.
 *
 * There are six See-all entry points in the app and they used to mean five
 * different things — three purpose-built screens, one directory, and two that
 * merely switched tabs. This is the common skeleton so they stop diverging:
 *
 *   1. header — back, an optional glyph saying what kind of list this is
 *   2. `facts` OR `blurb`, never both: facts when the list has measurable
 *      properties worth stating, a blurb when what matters is provenance or
 *      instruction
 *   3. controls — passed in as `controls`, off unless the list is long enough
 *      to need reordering or the catalog can genuinely enforce a filter
 *   4. the rows themselves
 *
 * A screen only pays for the parts it switches on, so the thin case stays as
 * cheap as it was when it was written by hand.
 */
export function SeeAllScreen({
  title,
  glyph,
  blurb,
  facts,
  controls,
  trailing,
  children,
}: {
  title: string;
  glyph?: string;
  blurb?: string;
  facts?: HubFact[];
  controls?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title={title} glyph={glyph} trailing={trailing} />
        {facts?.length ? (
          <FactStrip facts={facts} pullUp />
        ) : blurb ? (
          <Text className="-mt-2 font-dm text-[12.5px] leading-[18px] text-taupe">{blurb}</Text>
        ) : null}
        {controls}
        {children}
      </ScreenScroll>
    </Screen>
  );
}
