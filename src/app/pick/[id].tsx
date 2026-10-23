import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { PocketDossierScreen, type DossierChip } from '@/components/pocket-dossier';
import { Screen, useAppGutter } from '@/components/layout';
import { BackButton, Check, EmptyState } from '@/components/ui';
import { useScoper } from '@/lib/store';
import { useControlSurface } from '@/lib/shadows';
import { formatDateChip, useViatorPicks, viatorFlagLabels, viatorTotalLabel } from '@/lib/viator';

const MAX_GUESTS = 8;
export default function PickScreen() {
  const control = useControlSurface(), selectedControl = useControlSurface(true);
  const gutter = useAppGutter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
          contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: gutter, paddingBottom: 24, gap: 16 }}>
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
  const guestsLabel = `${guests} guest${guests > 1 ? 's' : ''}`;
  const summaryLine = selectedDate ? `${formatDateChip(selectedDate).weekday}, ${guestsLabel}` : guestsLabel;

  const bookOnViator = () => Linking.openURL(pick.bookingUrl).catch(() => showToast('Could not open Viator'));

  const planned=isPlanned('pick',pick.id);
  const price=pick.priceFrom!=null&&pick.currency?'From '+pick.currency+' '+pick.priceFrom:null;
  const chips:DossierChip[]=[
    ...(price?[{key:'price',label:price}]:[]),
    ...(pick.durationLabel?[{key:'duration',glyph:'clock',label:pick.durationLabel}]:[]),
    {key:'save',label:planned?'Saved':'Save',glyph:planned?'check':'bookmark',selected:planned,onPress:()=>togglePlan('pick',pick.id,pick.title)},
    {key:'book',label:'Book',glyph:'arrow',accent:true,onPress:bookOnViator},
  ];
  return <PocketDossierScreen image={pick.image} glyph="compass" eyebrow="Experience" chips={chips}
    context={{kind:'pick',id:pick.id,name:pick.title,caption:pick.destination,snapshot:pick.description,
      facts:[{label:'Destination',value:pick.destination},...(price?[{label:'Price',value:price}]:[]),...(pick.durationLabel?[{label:'Duration',value:pick.durationLabel}]:[]),...(pick.inclusions.length?[{label:'Included',value:pick.inclusions.join(' · ')}]:[])],
      links:[{label:'Book on Viator',url:pick.bookingUrl}]}}
    essentials={[{label:'Destination',value:pick.destination},...(pick.freeCancellation?[{label:'Cancellation',value:'Free cancellation listed'}]:[]),...(flagLabels.length?[{label:'Booking details',value:flagLabels.join(' · ')}]:[])]}>
    <View style={{gap:18}}>
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
                      style={selected ? selectedControl : control} className="flex-1 items-center rounded-full py-2.5">
                      <Text className={`font-dm text-meta ${selected ? 'text-on-selected' : 'text-taupe'}`}>{weekday}</Text>
                      <Text className={`mt-0.5 font-dm-bold text-[17px] ${selected ? 'text-on-selected' : 'text-ink'}`}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="flex-row items-center justify-between rounded-card border border-edge-card border-b-edge-card-bottom bg-shell px-4 py-3.5 shadow-soft-light dark:shadow-soft-dark">
            <Text className="font-dm-medium text-[14px] text-ink">Guests</Text>
            <View className="flex-row items-center gap-x-4">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fewer guests"
                disabled={guests <= 1}
                activeOpacity={0.7}
                onPress={() => setGuests((g) => Math.max(1, g - 1))}
                className={`h-8 w-8 items-center justify-center rounded-full border ${guests <= 1 ? 'border-edge-faint' : 'border-taupe'}`}>
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


      <View style={{gap:5}}>
        <Text className="font-dm text-label text-ink">{summaryLine} · {total ?? 'See price on Viator'}</Text>
        <Text className="font-dm text-fine text-taupe" style={{lineHeight:17}}>Estimate only — choose your date and guests again on Viator to book. Wayvee may earn a commission.</Text>
      </View>
    </View>
  </PocketDossierScreen>;
}
