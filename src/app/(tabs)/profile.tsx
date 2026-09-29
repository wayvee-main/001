import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedTouchable, RaisedView } from '@/components/raised-surface';
import { ChevronRight, Icon } from '@/components/ui';
import { APPEARANCE_OPTIONS, restoreAppearance, saveAppearance, type AppearancePreference } from '@/lib/appearance';
import { initialsFor } from '@/lib/auth';
import { EVENTS, GUEST, isCurrentEvent } from '@/lib/data';
import { ICON_PATHS } from '@/lib/icons';
import { stayProgress } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    deviceLocation,
    followedVenues,
    locationCanAskAgain,
    locationStatus,
    openSheet,
    plans,
    profileAvatarUrl,
    requestLocation,
    savedPlaceKeys,
    session,
    showToast,
    stay,
  } = useScoper();
  const colors = useThemeColors();
  const [appearance, setAppearance] = useState<AppearancePreference>('system');
  const stayValue = stay
    ? (() => {
        const progress = stayProgress(stay);
        return `Night ${progress.currentNight} of ${progress.totalNights}`;
      })()
    : 'Not linked';
  const currentPlanCount = plans.filter((eventId) => {
    const event = EVENTS[eventId];
    return event && isCurrentEvent(event);
  }).length;
  const nextEventId = plans.find((eventId) => {
    const event = EVENTS[eventId];
    return event && isCurrentEvent(event);
  });
  const nextEvent = nextEventId ? EVENTS[nextEventId] : null;
  const displayName = session?.user.name ?? GUEST.name;
  const locationValue = locationStatus === 'granted'
    ? deviceLocation?.label || 'Enabled'
    : locationStatus === 'denied'
      ? 'Off'
      : locationStatus === 'skipped'
        ? 'Not now'
        : 'Not set';

  useEffect(() => {
    restoreAppearance().then(setAppearance).catch(() => undefined);
  }, []);

  const chooseAppearance = (preference: AppearancePreference) => {
    setAppearance(preference);
    saveAppearance(preference).catch(() => showToast('Could not save your appearance choice'));
  };

  const manageLocation = async () => {
    if (locationStatus === 'denied' && !locationCanAskAgain) {
      try {
        await Linking.openSettings();
      } catch {
        showToast('Open your device settings to enable location');
      }
      return;
    }
    try {
      const nextStatus = await requestLocation();
      showToast(nextStatus === 'granted' ? 'Location access enabled' : 'Location access was not enabled');
    } catch {
      showToast('Could not update location access');
    }
  };

  const stats: { value: number; label: string; onPress: () => void }[] = [
    { value: savedPlaceKeys.length, label: 'Saved', onPress: () => router.push('/saved') },
    { value: currentPlanCount, label: 'Plans', onPress: () => router.push('/plans') },
    { value: followedVenues.length, label: 'Following', onPress: () => router.push('/following') },
  ];

  const locationRow = {
    icon: 'M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z',
    label: 'Location access',
    value: locationValue,
    onPress: manageLocation,
  };
  // Stay + taste are account data — only worth showing once there's an account to hold them.
  const preferenceRows: { icon: string; label: string; value?: string; onPress: () => void | Promise<void> }[] = session
    ? [
        { icon: ICON_PATHS.luggage, label: stay ? stay.propertyName : 'Your stay', value: stayValue, onPress: () => openSheet('stay') },
        { icon: ICON_PATHS.sparkles, label: 'Taste profile', onPress: () => router.push('/taste') },
        locationRow,
      ]
    : [locationRow];

  const trustRows: { icon: string; label: string; onPress: () => void | Promise<void> }[] = session
    ? [
        {
          icon: 'M10 17l5 -5l-5 -5 M15 12h-12 M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-5',
          label: 'Sign out',
          onPress: () => openSheet('logout'),
        },
      ]
    : [];

  return (
    <Screen>
      <ScreenScroll gap={18} clearsTabBar>
        {/* Identity */}
        <View className="flex-row items-center gap-x-3.5">
          <View className="h-[52px] w-[52px] items-center justify-center rounded-full border border-sand bg-coral-50">
            {profileAvatarUrl ? (
              <Image source={{ uri: profileAvatarUrl }} contentFit="cover" style={{ width: 50, height: 50, borderRadius: 25 }} />
            ) : (
              <Text className="font-dm-bold text-[16px] text-ink">{initialsFor(displayName)}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-dm-bold text-[17px] text-ink">{displayName}</Text>
            <Text className="mt-0.5 font-dm text-[13px] leading-[18px] text-taupe">
              {session?.user.email || `Browsing as a guest · ${GUEST.anchor}`}
            </Text>
          </View>
        </View>

        {!session ? (
          <View className="items-center gap-y-3 rounded-card border border-sand bg-coral-50 px-5 py-6">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-shell">
              <Icon d={ICON_PATHS.sparkles} size={20} color={colors.rust} strokeWidth={1.8} />
            </View>
            <View className="items-center gap-y-1">
              <Text className="font-fraunces text-[18px] text-ink">Sign in to make this yours</Text>
              <Text className="max-w-[280px] text-center font-dm text-[12.5px] leading-[18px] text-taupe">
                Save places, plan your nights, and get a taste profile that follows you — synced across devices.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => openSheet('auth')}
              className="mt-1 h-[44px] w-full items-center justify-center rounded-full bg-ember">
              <Text className="font-dm-bold text-[13.5px] text-white">Sign in or create account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Live counts that tap through to the surfaces they summarize. */}
            <View className="flex-row gap-x-2">
              {stats.map((stat) => (
                <RaisedTouchable
                  key={stat.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${stat.label}: ${stat.value}`}
                  activeOpacity={0.72}
                  onPress={stat.onPress}
                  className="flex-1 items-center rounded-card py-3">
                  <Text className="font-fraunces text-[20px] text-ink">{stat.value}</Text>
                  <Text className="mt-0.5 font-dm text-meta text-taupe">{stat.label}</Text>
                </RaisedTouchable>
              ))}
            </View>

            {/* Plans first — a live launcher, not static text. Always matches Home & /plans. */}
            <View className="gap-y-2.5">
              <Text className="font-fraunces text-[19px] text-ink">My plans</Text>

              {nextEvent ? (
                <RaisedTouchable
                  tone="vee"
                  activeOpacity={0.7}
                  onPress={() => router.push(`/event/${nextEvent.id}`)}
                  className="flex-row items-center gap-x-3 rounded-card px-3 py-2.5">
                  <Photo uri={nextEvent.image} radius={9} style={{ width: 40, height: 40 }} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-dm-medium text-[13.5px] text-ink">{nextEvent.name}</Text>
                    <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{nextEvent.time} · {nextEvent.venue}</Text>
                  </View>
                  <ChevronRight color={colors.taupe} />
                </RaisedTouchable>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/discover')}
                  className="flex-row items-center gap-x-3 rounded-card border border-dashed border-sand bg-shell px-3.5 py-3.5">
                  <Icon d={ICON_PATHS.ticket} size={18} color={colors.taupe} strokeWidth={1.6} />
                  <Text className="flex-1 font-dm text-[14px] text-taupe">Nothing planned yet — browse Discover</Text>
                  <ChevronRight />
                </TouchableOpacity>
              )}

              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/plans')}>
                <Text className="text-center font-dm-medium text-label text-rust">See all plans ›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Settings — preferences first, trust + exit last */}
        <View className="gap-y-2.5">
          <Text className="font-fraunces text-[19px] text-ink">Settings</Text>

          {/* Appearance sits above the row list because it's the one setting
              that changes the screen you're looking at while you look at it. */}
          <RaisedView className="rounded-card px-3.5 py-[15px]">
            <Text className="font-dm text-[14.5px] text-fg">Appearance</Text>
            <View className="mt-2.5 flex-row gap-x-1.5 rounded-control bg-surface-sunk p-1">
              {APPEARANCE_OPTIONS.map((option) => {
                const selected = appearance === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.7}
                    onPress={() => chooseAppearance(option.value)}
                    className={`flex-1 items-center rounded-control py-2 ${selected ? 'bg-accent-fill' : ''}`}>
                    <Text
                      className={`font-dm-medium text-label ${selected ? 'text-on-accent' : 'text-fg-muted'}`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </RaisedView>

          <RaisedView className="overflow-hidden rounded-card px-3.5">
            {preferenceRows.map((r, i) => (
              <TouchableOpacity
                key={r.label}
                activeOpacity={0.7}
                onPress={r.onPress}
                className={`flex-row items-center gap-x-3 py-[15px] ${i < preferenceRows.length - 1 ? 'border-b border-sand' : ''}`}>
                <Icon d={r.icon} size={18} color={colors['fg-muted']} strokeWidth={1.6} />
                <Text className="flex-1 font-dm text-[14.5px] text-ink">{r.label}</Text>
                {r.value ? <Text className="font-dm text-[13px] text-taupe">{r.value}</Text> : null}
                <ChevronRight />
              </TouchableOpacity>
            ))}
          </RaisedView>
          {trustRows.length > 0 ? (
            <RaisedView className="overflow-hidden rounded-card px-3.5">
              {trustRows.map((r, i) => (
                <TouchableOpacity
                  key={r.label}
                  activeOpacity={0.7}
                  onPress={r.onPress}
                  className={`flex-row items-center gap-x-3 py-[15px] ${i < trustRows.length - 1 ? 'border-b border-sand' : ''}`}>
                  <Icon d={r.icon} size={18} color={colors['fg-muted']} strokeWidth={1.6} />
                  <Text className="flex-1 font-dm text-[14.5px] text-ink">{r.label}</Text>
                  <ChevronRight />
                </TouchableOpacity>
              ))}
            </RaisedView>
          ) : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
