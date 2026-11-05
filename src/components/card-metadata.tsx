import { View } from 'react-native';
import { MetadataPill } from '@/components/metadata-pill';
import type { CardMetadataItem } from '@/lib/card-metadata';

/** Solid pastel capsules keep regular glyph/text sizing in both themes. */
export function CardMetadata({ items, note, equalWidth = false, compact = false }: { items: readonly CardMetadataItem[]; note?: string; equalWidth?: boolean; compact?: boolean }) {
  if (!items.length) return null;
  return <View testID="card-metadata" style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 6 }}>
      {items.map(item => <MetadataPill key={item.key} testID={`card-metadata-${item.key}`} text={item.text} label={item.label} glyph={item.glyph} tone={item.tone} compact={compact} equalWidth={items.length > 1 && equalWidth} />)}
    </View>
    {note ? <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}><MetadataPill testID="card-metadata-note" text={note} label={note} tone="offer" compact={compact} /></View> : null}
  </View>;
}
