import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailBottomNav } from '@/components/bottom-nav';
import { DetailSheet } from '@/components/detail';
import { AppBackdrop, Screen } from '@/components/layout';
import { Photo } from '@/components/photo';
import { BackButton, Check, EmptyState, Icon } from '@/components/ui';
import { useScoper } from '@/lib/store';
import { formatDateChip, useViatorPicks, viatorFlagLabels, viatorTotalLabel } from '@/lib/viator';

const MAX_GUESTS = 8;
const HEART = 'M20.84 4.61a5.5 5.5 0 0 0 -7.78 0l-1.06 1.06l-1.06 -1.06a5.5 5.5 0 0 0 -7.78 7.78l1.06 1.06l7.78 7.78l7.78 -7.78l1.06 -1.06a5.5 5.5 0 0 0 0 -7.78z';

function BackCircle({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Go back"
      activeOpacity={0.7}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/45">
      <Text className="-mt-0.5 font-dm-bold text-[17px] text-white">‹</Text>
    </TouchableOpacity>
  );
}

/** Pin toggle for a dated Viator pick — same "add to plans" concept as an
 * event's own heart button (event/[id].tsx), styled for this screen's dark
 * hero instead of DetailIconButton's light-hero shell. A pick has no night
 * stop of its own (daytime, own booking flow) so this is the only plan
 * affordance it gets — no "Plan a night around this" CTA. */
function PlanCircle({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={onPress}
      className={`h-10 w-10 items-center justify-center rounded-full ${active ? 'bg-rust' : 'bg-black/45'}`}>
      <Icon d={HEART} size={16} color="#FFFFFF" fill={active ? '#FFFFFF' : 'none'} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

export default function PickScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast, isPlanned, togglePlan } = useScoper();
  const picks = useViatorPicks();
  const pick = picks.find((p) => p.id === id);

  const [selectedDate, setSelectedDate] = useState<string | null>(pick?.availabilityDates[0] ?? null);
  const [guests, setGuests] = useState(2);

  if (!pick) {
    return (
      <Screen>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
          <View className="flex-row items-center">
            <BackButton />
          </View>
          <EmptyState
            title="Pick unavailable"
            message="This listing may have rotated out. Browse Home for current picks."
            actionLabel="Back to Home"
            onAction={() => router.replace('/')}
          />
        </ScrollView>
      </Screen>
    );
  }

  const flagLabels = viatorFlagLabels(pick);
  const total = viatorTotalLabel(pick, guests);
  const metaLine = [pick.durationLabel, pick.destination].filter(Boolean).join(' · ');
  const guestsLabel = `${guests} guest${guests > 1 ? 's' : ''}`;
  const summaryLine = selectedDate ? `${formatDateChip(selectedDate).weekday}, ${guestsLabel}` : guestsLabel;

  const bookOnViator = () => Linking.openURL(pick.bookingUrl).catch(() => showToast('Could not open Viator'));

  return (
    <AppBackdrop>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Photo uri={pick.image} radius={0} style={{ height: 211 + insets.top }}>
          <View style={{ top: insets.top + 10 }} className="absolute left-4 right-4 flex-row items-center justify-between">
            <BackCircle onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <PlanCircle
              active={isPlanned('pick', pick.id)}
              label={isPlanned('pick', pick.id) ? `Remove ${pick.title} from plans` : `Add ${pick.title} to plans`}
              onPress={() => togglePlan('pick', pick.id, pick.title)}
            />
          </View>
        </Photo>

        <DetailSheet>
          <View className="gap-y-1.5">
            <Text className="font-dm-bold text-[9.5px] tracking-[0.6px] text-peach">VIATOR</Text>
            <Text className="font-fraunces text-[24px] leading-[28px] text-ink">{pick.title}</Text>
            {metaLine ? <Text numberOfLines={1} className="font-dm text-[13px] text-taupe">{metaLine}</Text> : null}

            {pick.freeCancellation || flagLabels.length ? (
              <View className="mt-1 flex-row flex-wrap gap-2">
                {pick.freeCancellation ? (
                  <View className="rounded-full bg-blush px-3 py-[7px]">
                    <Text className="font-dm-medium text-meta text-peach">Free cancellation</Text>
                  </View>
                ) : null}
                {flagLabels.map((label) => (
                  <View key={label} className="rounded-full bg-shell px-3 py-[7px]">
                    <Text className="font-dm-medium text-meta text-ink">{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {pick.availabilityDates.length ? (
            <View className="gap-y-2.5">
              <Text className="font-dm-bold text-[14px] text-ink">Choose a date</Text>
              <View className="flex-row gap-x-2">
                {pick.availabilityDates.map((iso) => {
                  const { weekday, day } = formatDateChip(iso);
                  const selected = iso === selectedDate;
                  return (
                    <TouchableOpacity
                      key={iso}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${weekday} ${day}`}
                      activeOpacity={0.75}
                      onPress={() => setSelectedDate(iso)}
                      className={`flex-1 items-center rounded-card border py-2.5 ${selected ? 'border-rust bg-blush' : 'border-sand bg-shell'}`}>
                      <Text className={`font-dm text-meta ${selected ? 'text-peach' : 'text-taupe'}`}>{weekday}</Text>
                      <Text className={`mt-0.5 font-dm-bold text-[17px] ${selected ? 'text-peach' : 'text-ink'}`}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="flex-row items-center justify-between rounded-card border border-sand bg-shell px-4 py-3.5 shadow-2xs">
            <Text className="font-dm-medium text-[14px] text-ink">Guests</Text>
            <View className="flex-row items-center gap-x-4">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fewer guests"
                disabled={guests <= 1}
                activeOpacity={0.7}
                onPress={() => setGuests((g) => Math.max(1, g - 1))}
                className={`h-8 w-8 items-center justify-center rounded-full border ${guests <= 1 ? 'border-sand' : 'border-taupe'}`}>
                <Text className={`font-dm-bold text-[16px] ${guests <= 1 ? 'text-taupe/50' : 'text-ink'}`}>−</Text>
              </TouchableOpacity>
              <Text className="w-5 text-center font-dm-bold text-[15px] text-ink">{guests}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="More guests"
                disabled={guests >= MAX_GUESTS}
                activeOpacity={0.7}
                onPress={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
                className="h-8 w-8 items-center justify-center rounded-full bg-rust">
                <Text className="font-dm-bold text-[16px] text-white">+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {pick.inclusions.length ? (
            <View className="gap-y-2.5">
              <Text className="font-dm-bold text-[14px] text-ink">What&apos;s included</Text>
              <View className="gap-y-2.5">
                {pick.inclusions.map((item) => (
                  <View key={item} className="flex-row items-start gap-x-2.5">
                    <View className="mt-0.5 h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pine/25">
                      <Check size={9} color="#5FCBA3" />
                    </View>
                    <Text className="min-w-0 flex-1 font-dm text-[12.5px] leading-[18px] text-taupe">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="h-px bg-sand" />
          <Text className="font-dm text-[12.5px] leading-[18px] text-taupe">{pick.description}</Text>
        </DetailSheet>
      </ScrollView>

      <View className="border-t border-sand bg-cream px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }} className="gap-y-2">
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-dm text-meta text-taupe">{summaryLine}</Text>
              <Text numberOfLines={1} className="font-dm-bold text-[18px] text-ink">{total ?? 'See price on Viator'}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} onPress={bookOnViator} className="h-12 items-center justify-center rounded-full bg-rust px-6">
              <Text className="font-dm-medium text-[13.5px] text-white">Book now</Text>
            </TouchableOpacity>
          </View>
          <Text className="font-dm text-[10.5px] leading-[14px] text-taupe">
            Estimate only — you&apos;ll choose your date and guests again on Viator to book · Wayvee may earn a commission
          </Text>
        </View>
      </View>
      <DetailBottomNav active="home" />
    </AppBackdrop>
  );
}
