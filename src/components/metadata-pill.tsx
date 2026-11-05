import { Text, View } from 'react-native';
import { Glyph } from '@/components/glyph';
import type { CardMetadataItem, MetadataTone } from '@/lib/card-metadata';
import { CARD_METADATA_LIMIT, compactCardText, metadataParts, numericDistanceLabel } from '@/lib/card-presentation';
import { useThemeColors } from '@/lib/theme';

/** One readable metadata capsule, reused by every card/poster family. */
export function MetadataPill({ text, glyph, label, compact = true, testID, equalWidth = false }: {
  text: string; glyph?: string; label?: string; tone?: MetadataTone; compact?: boolean; testID?: string; equalWidth?: boolean;
}) {
  const colors = useThemeColors();
  return <View testID={testID} accessible accessibilityLabel={numericDistanceLabel(label || text)}
    style={{ flex: equalWidth ? 1 : undefined, flexShrink: 1, minWidth: 0, maxWidth: '100%', minHeight: compact ? 27 : 30,
      paddingHorizontal: 8, paddingVertical: compact ? 4 : 5, borderRadius: 999, borderWidth: 0,
      backgroundColor: colors['accent-tint'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
    {glyph ? <Glyph name={glyph} size={12} strokeWidth={1.5} color={colors['fg-accent']} /> : null}
    <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm" style={{ flexShrink: 1, fontSize: 11, lineHeight: compact ? 17 : 16, color: colors['fg-accent'] }}>{compactCardText(numericDistanceLabel(text), CARD_METADATA_LIMIT)}</Text>
  </View>;
}

export function MetadataLine({ text, glyph, items, limit = 2, compact = true }: { text?: string; glyph?: string; items?: readonly CardMetadataItem[]; limit?: number; compact?: boolean }) {
  const values = items || metadataParts(text || '').map((part, index) => ({ key: String(index), text: part, label: part, glyph: index === 0 ? glyph : undefined,
    tone: /\b(?:mi|miles?|km)\b/i.test(part) ? 'distance' as const : /\$/.test(part) ? 'offer' as const : 'category' as const }));
  if (!values.length) return null;
  const distance = values.find(item => item.tone === 'distance');
  const visible = !items && limit === 2 && distance && values.indexOf(distance) > 1 ? [values[0], distance] : values.slice(0, limit);
  return <View testID="metadata-line" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
    {visible.map(item => <MetadataPill key={item.key} text={item.text} label={item.label} glyph={item.glyph} tone={item.tone} compact={compact} />)}
  </View>;
}
