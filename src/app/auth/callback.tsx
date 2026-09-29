import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { LaunchScreen } from '@/components/onboarding';
import { supabase } from '@/lib/supabase';
import { useScoper } from '@/lib/store';

/**
 * Lands here from a deep link with a code param — an email-confirmation link, since
 * native Google sign-in completes inline via WebBrowser.openAuthSessionAsync and never
 * routes through this screen. Without this route, that deep link 404'd instead of
 * finishing the sign-in.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const showToast = useScoper((s) => s.showToast);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    (async () => {
      const code = Array.isArray(params.code) ? params.code[0] : params.code;
      const errorDescription = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;

      if (errorDescription) {
        showToast(errorDescription);
      } else if (code && supabase) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        showToast(error ? 'Could not finish signing in — try again.' : 'Signed in — welcome to Wayvee');
      }
      router.replace('/');
    })();
  }, [params.code, params.error_description, router, showToast]);

  return <LaunchScreen />;
}
