import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { WorkingVee } from '@/components/vee-mark';
import { AppBackdrop } from '@/components/layout';
import { useThemeColors } from '@/lib/theme';

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  autoComplete,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'name' | 'email' | 'password' | 'new-password';
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  const colors = useThemeColors();

  return (
    <View className="gap-y-1.5">
      <Text className="font-dm-medium text-label text-taupe">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.taupe}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`h-[48px] rounded-card border px-4 font-dm text-[14px] text-ink ${focused ? 'border-rust bg-shell' : 'border-sand bg-shell'}`}
      />
    </View>
  );
}

/** Held while fonts and the first hydration land. The breathing mark replaces
 * the old spinner: it is already the app's "Vee is working" signal everywhere
 * else, so the wait reads as the concierge starting up rather than as a
 * generic load. */
export function LaunchScreen() {
  const colors = useThemeColors();
  return (
    <AppBackdrop>
      <View className="flex-1 items-center justify-center gap-y-7 px-8">
        <WorkingVee size={78} />
        <Text style={{ color: colors.fg }} className="font-fraunces text-[32px]">
          Wayvee
        </Text>
      </View>
    </AppBackdrop>
  );
}
