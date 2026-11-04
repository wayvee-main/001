import { Text, View } from 'react-native';
import { Glyph } from '@/components/glyph';
import type { CardMetadataItem } from '@/lib/card-metadata';
import { useThemeColors } from '@/lib/theme';

/** Solid pastel capsules keep regular glyph/text sizing in both themes. */
export function CardMetadata({ items, note, equalWidth = false }: { items: readonly CardMetadataItem[]; note?: string; equalWidth?: boolean }) {
  const colors = useThemeColors();
  if (!items.length) return null;
  return <View testID="card-metadata" style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 6 }}>
      {items.map(item => <View key={item.key} testID={`card-metadata-${item.key}`} accessible accessibilityLabel={item.label}
        style={{ flex: items.length > 1 && equalWidth ? 1 : undefined, flexShrink: 1, minWidth: 0, maxWidth: '100%', minHeight: 30, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: colors[`metadata-${item.tone}`],
          borderWidth: 0,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {item.glyph ? <Glyph name={item.glyph} size={12} strokeWidth={1.5} color={colors[`metadata-${item.tone}-ink`]} /> : null}
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm" style={{ flexShrink: 1, fontSize: 11, lineHeight: 16, color: colors[`metadata-${item.tone}-ink`] }}>{item.text}</Text>
      </View>)}
    </View>
    {note ? <Text testID="card-metadata-note" accessibilityLabel={note} numberOfLines={1} className="font-dm text-taupe" style={{ fontSize: 11, lineHeight: 16 }}>{note}</Text> : null}
  </View>;
}
