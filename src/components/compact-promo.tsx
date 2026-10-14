import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';

import { MiniChevron } from '@/components/ui';
import type { WayveePromotion } from '@/lib/promotions';
import { useScoper } from '@/lib/store';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

function PromoSummary({ promotion, compact = false }: { promotion: WayveePromotion; compact?: boolean }) {
  const summary = promotion.finePrint
    ? `${promotion.detail} · ${promotion.finePrint}`
    : promotion.detail;

  return (
    <Text
      numberOfLines={compact ? 1 : 2}
      className={`font-dm text-taupe ${compact ? 'mt-0.5 text-[10px] leading-[13px]' : 'mt-0.5 text-[11px] leading-[15px]'}`}>
      {summary}
    </Text>
  );
}

export function CompactPromo({ promotion, compact = false }: { promotion: WayveePromotion; compact?: boolean }) {
  const showToast = useScoper((state) => state.showToast);
  const colors = useThemeColors();
  const surface = useRaisedSurface(1), primary = useControlSurface(false, true);

  const openAction = (label: string, url: string) => {
    Linking.openURL(url).catch(() => showToast(`Could not open ${label}`));
  };

  return (
    <View style={surface} className={`overflow-hidden rounded-card border ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5'}`}>
      <View className="flex-row items-stretch gap-x-2.5">
        <View className="min-w-0 flex-1">
          <Text className={`font-dm-bold ${compact ? 'text-[8px] tracking-[0.6px]' : 'text-[8.5px] tracking-[0.7px]'} text-taupe`}>{promotion.eyebrow}</Text>
          <Text numberOfLines={1} className={`${compact ? 'mt-0.5 text-[12.5px] leading-[16px]' : 'mt-0.5 text-[14px] leading-[18px]'} font-dm-bold text-ink`}>
            {promotion.title}
          </Text>
          <PromoSummary promotion={promotion} compact={compact} />

          <View className={`${compact ? 'mt-1.5' : 'mt-2'} flex-row items-center gap-x-2`}>
            {promotion.actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                accessibilityRole="link"
                accessibilityLabel={`${action.label}: ${promotion.title}`}
                activeOpacity={0.72}
                hitSlop={6}
                style={action.primary ? primary : undefined}
                onPress={() => openAction(action.label, action.url)}
                className={`flex-row items-center gap-x-1 rounded-full ${action.primary
                  ? `border ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'}`
                  : 'px-0.5 py-1'}`}>
                <Text className={`font-dm-medium ${compact ? 'text-[10px]' : 'text-[10.5px]'} ${action.primary ? 'text-on-accent' : 'text-peach'}`}>
                  {action.label}
                </Text>
                <MiniChevron color={action.primary ? colors['on-accent'] : colors.peach} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
