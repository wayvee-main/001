// Real local (on-device) notification scheduling for plan reminders — no
// push infrastructure, no server involved. Every call schedules against a
// real future Date computed from the guest's own plans (see lib/reminders.ts
// for the "what to remind" logic); this file only owns "how to actually fire
// it". Web has no reliable local-notification API, so every function no-ops
// there rather than pretending to schedule something that will never fire.
// Same no-op treatment applies whenever the native module itself isn't
// available (Expo Go dropped expo-notifications support in SDK 53+, and a
// dev client built before this plugin was added won't have it linked yet
// either). This is why the import is dynamic, not static: expo-notifications
// resolves several native submodules at import time, which throws
// synchronously when one isn't linked — and since this file is pulled in by
// lib/store.ts, loaded on every screen, a static import would crash the
// whole app rather than just the reminder feature.
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let nativeModuleAvailable = Platform.OS !== 'web';
let cachedModule: NotificationsModule | null = null;
let handlerRegistered = false;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!nativeModuleAvailable) return null;
  if (cachedModule) return cachedModule;
  try {
    const mod = await import('expo-notifications');
    if (!handlerRegistered) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      handlerRegistered = true;
    }
    cachedModule = mod;
    return mod;
  } catch {
    nativeModuleAvailable = false;
    return null;
  }
}

const ANDROID_CHANNEL_ID = 'wayvee-reminders';
let androidChannelReady = false;

async function ensureAndroidChannel(mod: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  await mod.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Plan reminders',
    importance: mod.AndroidImportance.DEFAULT,
  });
  androidChannelReady = true;
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'unsupported';

/** Read-only current status — safe to call from a screen's mount effect,
 * never prompts. Collapses to 'unsupported' if the native module is missing
 * (Expo Go, or a dev client built before this plugin was added). */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const mod = await loadNotifications();
  if (!mod) return 'unsupported';
  try {
    const existing = await mod.getPermissionsAsync();
    return existing.granted ? 'granted' : 'denied';
  } catch {
    nativeModuleAvailable = false;
    return 'unsupported';
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermissionStatus> {
  const mod = await loadNotifications();
  if (!mod) return 'unsupported';
  try {
    const existing = await mod.getPermissionsAsync();
    if (existing.granted) return 'granted';
    if (!existing.canAskAgain) return 'denied';
    const requested = await mod.requestPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  } catch {
    nativeModuleAvailable = false;
    return 'unsupported';
  }
}

/** Stable per-reminder identifier so re-scheduling the same plan replaces its
 * old notification instead of stacking duplicates. */
function identifierFor(key: string): string {
  return `wayvee-${key}`;
}

export async function cancelReminder(key: string): Promise<void> {
  const mod = await loadNotifications();
  if (!mod) return;
  await mod.cancelScheduledNotificationAsync(identifierFor(key)).catch(() => {});
}

/** Schedules a one-shot local notification at a real future Date. Returns
 * false (never throws) when notifications aren't supported, permission was
 * refused, or the time has already passed — callers can use that to decide
 * whether to surface a toast, but nothing here fakes success. */
export async function scheduleReminder(key: string, title: string, body: string, fireAt: Date): Promise<boolean> {
  if (fireAt.getTime() <= Date.now()) return false;

  const mod = await loadNotifications();
  if (!mod) return false;

  const status = await ensureNotificationPermission();
  if (status !== 'granted') return false;

  try {
    await ensureAndroidChannel(mod);
    await cancelReminder(key);
    await mod.scheduleNotificationAsync({
      identifier: identifierFor(key),
      content: { title, body },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch {
    nativeModuleAvailable = false;
    return false;
  }
}
