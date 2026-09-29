import { colorScheme } from 'nativewind';

import { getStoredItem, setStoredItem } from '@/lib/storage';

// Device-local appearance choice. Mirrors location.ts/stay.ts: a preference
// about this device's screen, not account data, so it stays out of Supabase —
// a guest on a bright patio and the same guest on a dark bedside phone want
// different answers, and syncing would fight that.
//
// 'system' is the default and defers to the OS, which is what app.json's
// "userInterfaceStyle": "automatic" already grants us. Light/dark pin it.

const APPEARANCE_KEY = 'wayvee.appearance.v1';

export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Push the preference into NativeWind. Safe to call before restore finishes. */
export function applyAppearance(preference: AppearancePreference): void {
  colorScheme.set(preference);
}

/** Read the stored choice, defaulting to 'system' when unset or corrupt. */
export async function restoreAppearance(): Promise<AppearancePreference> {
  const raw = await getStoredItem(APPEARANCE_KEY);
  return isAppearancePreference(raw) ? raw : 'system';
}

/** Apply immediately, then persist — the screen should never wait on storage. */
export async function saveAppearance(preference: AppearancePreference): Promise<void> {
  applyAppearance(preference);
  await setStoredItem(APPEARANCE_KEY, preference);
}
