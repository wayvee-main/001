import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { deleteStoredItem } from '@/lib/storage';
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase';

const LEGACY_SESSION_KEY = 'wayvee.session.v1';
const LOCAL_GUEST_KEY = 'wayvee.guest-session.v2';

WebBrowser.maybeCompleteAuthSession();

export interface WayveeUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  mode: 'account';
}

export interface WayveeSession {
  source: 'supabase';
  user: WayveeUser;
}

export interface RegistrationResult {
  session: WayveeSession | null;
  needsEmailVerification: boolean;
}

export class AuthConfigurationError extends Error {
  constructor() {
    super('Wayvee accounts are not connected yet. Add the Supabase project URL and publishable key.');
    this.name = 'AuthConfigurationError';
  }
}

export const isAccountAuthConfigured = isSupabaseConfigured;

function metadataString(user: User, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function sessionFor(supabaseSession: Session): WayveeSession {
  const user = supabaseSession.user;
  const email = user.email?.trim().toLowerCase();
  const name = metadataString(user, 'full_name', 'display_name', 'name', 'given_name')
    || email?.split('@')[0]
    || 'Guest';

  return {
    source: 'supabase',
    user: {
      id: user.id,
      name,
      email,
      avatarUrl: metadataString(user, 'avatar_url', 'picture'),
      mode: 'account',
    },
  };
}

function authMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'That email and password do not match.';
  if (normalized.includes('email not confirmed')) return 'Confirm your email, then sign in.';
  if (normalized.includes('user already registered')) return 'An account already exists for that email.';
  if (normalized.includes('anonymous sign-ins are disabled')) return 'Guest access has not been enabled in the Wayvee backend.';
  if (normalized.includes('rate limit')) return 'Too many attempts. Wait a moment and try again.';
  return message || 'We could not complete that request. Please try again.';
}

function redirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URL('/', window.location.origin).toString();
  }
  return Linking.createURL('auth/callback');
}

async function exchangeWebCallback(): Promise<void> {
  if (!supabase || Platform.OS !== 'web' || typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (oauthError) {
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    throw new Error(oauthError);
  }

  const code = url.searchParams.get('code');
  if (!code) return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error(authMessage(error.message));

  url.searchParams.delete('code');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function restoreSession(): Promise<WayveeSession | null> {
  await Promise.all([deleteStoredItem(LEGACY_SESSION_KEY), deleteStoredItem(LOCAL_GUEST_KEY)]);

  if (supabase) {
    await exchangeWebCallback();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(authMessage(error.message));
    if (data.session?.user.is_anonymous) {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }
    if (data.session) return sessionFor(data.session);
  }
  return null;
}

export async function signInWithEmail(email: string, password: string): Promise<WayveeSession> {
  if (!isSupabaseConfigured) throw new AuthConfigurationError();
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(authMessage(error.message));
  if (!data.session) throw new Error('Wayvee did not receive a complete session.');
  await deleteStoredItem(LOCAL_GUEST_KEY);
  return sessionFor(data.session);
}

export async function createAccount(name: string, email: string, password: string): Promise<RegistrationResult> {
  if (!isSupabaseConfigured) throw new AuthConfigurationError();
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: name.trim(), display_name: name.trim() },
      emailRedirectTo: redirectUrl(),
    },
  });
  if (error) throw new Error(authMessage(error.message));
  if (!data.session) return { session: null, needsEmailVerification: true };
  await deleteStoredItem(LOCAL_GUEST_KEY);
  return { session: sessionFor(data.session), needsEmailVerification: false };
}

export async function signInWithGoogle(): Promise<WayveeSession | null> {
  if (!isSupabaseConfigured) throw new AuthConfigurationError();
  const client = requireSupabase();
  const returnTo = redirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: returnTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(authMessage(error.message));
  if (!data.url) throw new Error('Google sign-in could not be started.');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(data.url);
    return null;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, returnTo);
  if (result.type !== 'success') return null;

  const callback = new URL(result.url);
  const oauthError = callback.searchParams.get('error_description') || callback.searchParams.get('error');
  if (oauthError) throw new Error(oauthError);
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('The sign-in provider did not return an authorization code.');

  const { data: sessionData, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(authMessage(exchangeError.message));
  if (!sessionData.session) throw new Error('Wayvee did not receive a complete session.');
  await deleteStoredItem(LOCAL_GUEST_KEY);
  return sessionFor(sessionData.session);
}

export function subscribeToAuthChanges(
  listener: (event: AuthChangeEvent, session: WayveeSession | null) => void,
): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
    listener(event, nextSession && !nextSession.user.is_anonymous ? sessionFor(nextSession) : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function clearSession(): Promise<void> {
  let signOutError: Error | null = null;
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) signOutError = new Error(authMessage(error.message));
  }
  await Promise.all([deleteStoredItem(LOCAL_GUEST_KEY), deleteStoredItem(LEGACY_SESSION_KEY)]);
  if (signOutError) throw signOutError;
}

export function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'G';
}

export function firstNameFor(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}
