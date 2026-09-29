import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from '@/lib/database.types';
import { deleteStoredItem, getStoredItem, setStoredItem } from '@/lib/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const authStorage = {
  getItem: (key: string) => getStoredItem(key),
  setItem: (key: string, value: string) => setStoredItem(key, value),
  removeItem: (key: string) => deleteStoredItem(key),
};

function configuredClient(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabasePublishableKey) return null;

  try {
    return createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
      },
      global: {
        headers: { 'x-application-name': `wayvee-${Platform.OS}` },
      },
    });
  } catch {
    return null;
  }
}

export const supabase = configuredClient();
export const isSupabaseConfigured = supabase !== null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Wayvee accounts are not connected yet. Add the Supabase project URL and publishable key.');
  }
  return supabase;
}
