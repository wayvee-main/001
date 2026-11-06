import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/layout';
import { Field } from '@/components/onboarding';
import { AuthHeadline, AuthPrimary } from '@/components/overlays';
import { useAppGutter } from '@/lib/gutter';
import { updatePassword } from '@/lib/auth';
import { useScoper } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/lib/theme';

/** How long to wait for the reset link's session before calling the link spent. */
const LINK_WAIT_MS = 8000;

type LinkState = 'checking' | 'ready' | 'invalid';

/**
 * "Set a new password" — where a reset email lands (wayvee://auth/reset on
 * a phone, /auth/reset on the web). The link carries a one-time code: native
 * exchanges it here; on the web, launch already exchanged it (restoreSession).
 * Either way the screen waits for that session before it lets anyone type.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const gutter = useAppGutter();
  const colors = useThemeColors();
  const showToast = useScoper(state => state.showToast);
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const linkError = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;
  const [link, setLink] = useState<LinkState>(() => (!supabase || linkError ? 'invalid' : 'checking'));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client || linkError) return;

    let settled = false;
    const settle = (next: LinkState) => {
      if (settled) return;
      settled = true;
      setLink(next);
    };
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) settle('ready');
    });
    const timer = setTimeout(() => settle('invalid'), LINK_WAIT_MS);

    (async () => {
      // A code works once; a re-run of this effect only waits for its session.
      if (code && Platform.OS !== 'web' && exchanged.current !== code) {
        exchanged.current = code;
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) return settle('invalid');
      }
      const { data: current } = await client.auth.getSession();
      if (current.session) settle('ready');
    })();

    return () => {
      settled = true;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [code, linkError]);

  const save = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      showToast('Password updated');
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your password could not be updated. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen layer="secondary" aurora>
      <View style={{ flex: 1, paddingHorizontal: gutter, paddingTop: 40 }}>
        {link === 'checking' ? (
          <View testID="reset-checking" className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.fg} />
          </View>
        ) : link === 'invalid' ? (
          <View testID="reset-invalid">
            <AuthHeadline page main="This link has " accent="expired." sub="Reset links work once, for a short while. Ask for a fresh one from Sign in." />
            <AuthPrimary label="Back to Wayvee" busy={false} disabled={false} onPress={() => router.replace('/')} />
          </View>
        ) : (
          <View testID="reset-form">
            <AuthHeadline page main="Set a new " accent="password." sub="At least 8 characters. You’ll stay signed in." />
            <View className="mt-6 gap-y-3">
              <Field label="New password" value={password} onChangeText={setPassword} placeholder="8+ characters" secureTextEntry autoComplete="new-password" maxLength={128} />
              <Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Type it again" secureTextEntry autoComplete="new-password" maxLength={128} />
            </View>
            {error ? (
              <View className="mt-3 rounded-control border border-edge-card border-b-edge-card-bottom bg-coral-50 px-3.5 py-2.5">
                <Text accessibilityLiveRegion="polite" className="font-dm text-[12px] leading-[17px] text-peach">{error}</Text>
              </View>
            ) : null}
            <AuthPrimary label="Save password" busy={busy} disabled={busy} onPress={save} />
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => router.replace('/')} className="mt-2 items-center py-2">
              <Text className="font-dm-bold text-label text-peach">Not now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Screen>
  );
}
