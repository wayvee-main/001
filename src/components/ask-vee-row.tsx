import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { RaisedTouchable } from '@/components/raised-surface';
import { ChevronRight } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';

/** The way out of a browse surface and into the concierge, in one shape both
 * search and the food hub use — Home's bar is search now, so this is how a
 * guest who wanted a night rather than a place still reaches Vee.
 *
 * It carries whatever was typed straight through: /create treats a q param as
 * authoritative and submits it (create.tsx:585-591), so nobody retypes their
 * own words to cross a screen boundary. */
export function AskVeeRow({
  query,
  onNavigate,
}: {
  query?: string;
  /** Runs before navigating — the search overlay uses it to close its sheet. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const trimmed = query?.trim() ?? '';
  return (
    <RaisedTouchable
      accessibilityRole="button"
      accessibilityLabel={trimmed ? `Ask Vee about ${trimmed}` : 'Ask Vee instead'}
      activeOpacity={0.7}
      onPress={() => {
        onNavigate?.();
        router.push(trimmed ? `/create?q=${encodeURIComponent(trimmed)}` : '/create?focus=1');
      }}
      className="flex-row items-center justify-between rounded-card px-3.5 py-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-x-3">
        <Glyph name="spark" size={17} color={colors.rust} strokeWidth={1.7} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} className="font-dm-medium text-[14px] text-ink">Ask Vee instead</Text>
          <Text numberOfLines={1} className="mt-0.5 font-dm text-label text-taupe">
            {trimmed ? `Plan a night around “${trimmed}”` : 'Describe the night and Vee builds the plan'}
          </Text>
        </View>
      </View>
      <ChevronRight />
    </RaisedTouchable>
  );
}
