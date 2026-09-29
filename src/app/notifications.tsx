import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { RaisedView } from '@/components/raised-surface';
import { Icon } from '@/components/ui';
import { milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
import { ensureNotificationPermission, getNotificationPermissionStatus, type NotificationPermissionStatus } from '@/lib/notifications';
import { useCuratedCoords } from '@/lib/places';
import { activeLeaveByReminders, activeReminders } from '@/lib/reminders';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useWeatherHours, weatherAt } from '@/lib/weather';

const BELL_ICON = 'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6 M9 17v1a3 3 0 0 0 6 0v-1';

export default function NotificationsScreen() {
  const plans = useScoper((s) => s.plans);
  const stay = useScoper((s) => s.stay);
  const deviceLocation = useScoper((s) => s.deviceLocation);
  const showToast = useScoper((s) => s.showToast);
  const weatherHours = useWeatherHours();
  const curatedCoords = useCuratedCoords();
  const [permission, setPermission] = useState<NotificationPermissionStatus | null>(null);
  const colors = useThemeColors();

  // Ticks every 30s so a leave-by entry's "Leave in N minutes" doesn't sit
  // stale while a guest stays on this screen watching the clock.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const anchor = usableAnchor(deviceLocation);
  const leaveByReminders = activeLeaveByReminders(
    plans,
    (event) => curatedCoords({ name: event.venue, address: event.addr }),
    (point) => (anchor ? walkMinutes(milesBetween(anchor, point)) : null),
    (date) => weatherAt(date, weatherHours),
    now,
  );
  const reminders = [...leaveByReminders, ...activeReminders(plans, stay, now)];

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermission);
  }, []);

  const enableNotifications = async () => {
    const status = await ensureNotificationPermission();
    setPermission(status);
    showToast(status === 'granted' ? 'Notifications enabled' : 'Notifications were not enabled');
  };

  return (
    <Screen>
      <ScreenScroll gap={18}>
        <HeaderRow title="Notifications" />

        {permission === 'denied' ? (
          <RaisedView className="flex-row items-center gap-x-3 rounded-card px-4 py-3.5">
            <View className="min-w-0 flex-1">
              <Text className="font-dm-medium text-[13px] text-ink">Get real reminders</Text>
              <Text className="mt-0.5 font-dm text-label text-taupe">Enable notifications for a nudge before plans and on checkout day.</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.75} onPress={enableNotifications} className="rounded-full bg-ember px-3.5 py-2">
              <Text className="font-dm-medium text-label text-white">Enable</Text>
            </TouchableOpacity>
          </RaisedView>
        ) : null}

        {reminders.length ? (
          <View className="gap-y-2.5">
            {reminders.map((reminder) => (
              <RaisedView key={reminder.key} className="flex-row items-center gap-x-3 rounded-card px-4 py-3.5">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-coral-50">
                  <Icon d={BELL_ICON} size={16} color={colors.peach} strokeWidth={1.8} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="font-dm-medium text-[13.5px] text-ink">{reminder.title}</Text>
                  <Text numberOfLines={1} className="mt-0.5 font-dm text-label text-taupe">{reminder.sub}</Text>
                </View>
              </RaisedView>
            ))}
          </View>
        ) : (
          <RaisedView className="items-center gap-y-3 rounded-card px-5 py-10">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-coral-50">
              <Icon d={BELL_ICON} size={20} color={colors.peach} strokeWidth={1.8} />
            </View>
            <Text className="font-fraunces text-[18px] text-ink">No notifications yet</Text>
            <Text className="text-center font-dm text-[13px] leading-[19px] text-taupe">
              Updates about your stay, plans, and bookings will show up here.
            </Text>
          </RaisedView>
        )}
      </ScreenScroll>
    </Screen>
  );
}
