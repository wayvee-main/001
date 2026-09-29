import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WayveeWordmark } from '@/components/wayvee-wordmark';
import { Sentry } from '@/lib/monitoring';

/** Root crash net — a render error anywhere below this used to white-screen the whole app.
 * Reports to Sentry when a DSN is configured; always shows a recoverable screen either way. */
export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <SafeAreaView className="flex-1 items-center justify-center bg-cream px-8">
          <WayveeWordmark size={30} />
          <Text className="mt-8 font-fraunces text-[22px] leading-[28px] text-ink">Something went sideways.</Text>
          <Text className="mt-2 max-w-[300px] text-center font-dm text-[13.5px] leading-[19px] text-taupe">
            Wayvee hit an unexpected error. Give it another try — your saved places and plans are safe.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={resetError}
            className="mt-6 h-[48px] items-center justify-center rounded-full bg-ember px-8">
            <Text className="font-dm-bold text-[14px] text-white">Try again</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
