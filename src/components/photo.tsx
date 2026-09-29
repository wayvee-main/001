import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Stripes } from '@/components/ui';
import { useThemeColors } from '@/lib/theme';

/**
 * Remote photo with the design's striped placeholder underneath —
 * shown while loading and kept if the image fails (offline, dead URL).
 */
export function Photo({
  uri,
  radius = 9,
  fit = 'cover',
  stripedPlaceholder = true,
  style,
  children,
}: {
  uri?: string;
  radius?: number;
  fit?: 'cover' | 'contain';
  stripedPlaceholder?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const colors = useThemeColors();
  if (!uri) {
    if (!stripedPlaceholder) {
      return <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: colors.shell }, style]}>{children}</View>;
    }
    return (
      <Stripes radius={radius} style={style}>
        {children}
      </Stripes>
    );
  }
  return (
    <View style={[{ position: 'relative', borderRadius: radius, overflow: 'hidden', backgroundColor: colors.shell }, style]}>
      {stripedPlaceholder ? (
        <Stripes radius={radius} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
      <Image
        source={{ uri }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit={fit}
        transition={200}
        cachePolicy="memory-disk"
      />
      {children}
    </View>
  );
}
