import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';

import { MiniChevron } from '@/components/ui';
import type { WayveePromotion } from '@/lib/promotions';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

const PROMO_TONES = {
  warm: {
    surface: 'border-[rgba(69,201,194,0.35)] bg-coral-50',
    eyebrow: 'text-peach',
    title: 'text-coralDark',
    primary: 'border-rust bg-rust',
    chevron: '#FFFFFF',
  },
  sage: {
    surface: 'border-[rgba(97,199,154,0.35)] bg-sage',
    eyebrow: 'text-pine',
    title: 'text-ink',
    primary: 'border-pine bg-pine',
    chevron: '#FFFFFF',
  },
  mist: {
    surface: 'border-[rgba(120,150,170,0.35)] bg-mist',
    eyebrow: 'text-taupe',
    title: 'text-ink',
    primary: 'border-night bg-night',
    chevron: '#FFFFFF',
  },
} as const;

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
  const tone = PROMO_TONES[promotion.tone];

  const openAction = (label: string, url: string) => {
    Linking.openURL(url).catch(() => showToast(`Could not open ${label}`));
  };

  return (
    <View className={`overflow-hidden rounded-card border ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5'} ${tone.surface}`}>
      <View className="flex-row items-stretch gap-x-2.5">
        <View className="min-w-0 flex-1">
          <Text className={`font-dm-bold ${compact ? 'text-[8px] tracking-[0.6px]' : 'text-[8.5px] tracking-[0.7px]'} ${tone.eyebrow}`}>{promotion.eyebrow}</Text>
          <Text numberOfLines={1} className={`${compact ? 'mt-0.5 text-[12.5px] leading-[16px]' : 'mt-0.5 text-[14px] leading-[18px]'} font-dm-bold ${tone.title}`}>
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
                onPress={() => openAction(action.label, action.url)}
                className={`flex-row items-center gap-x-1 rounded-full ${action.primary
                  ? `border ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'} ${tone.primary}`
                  : 'px-0.5 py-1'}`}>
                <Text className={`font-dm-medium ${compact ? 'text-[10px]' : 'text-[10.5px]'} ${action.primary ? 'text-white' : 'text-peach'}`}>
                  {action.label}
                </Text>
                <MiniChevron color={action.primary ? tone.chevron : colors.peach} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
