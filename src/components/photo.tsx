import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Stripes } from '@/components/ui';
import { Glyph, type GlyphName } from '@/components/glyph';
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
  fallbackGlyph,
  fallbackLabel = 'Photo unavailable',
  style,
  children,
}: {
  uri?: string;
  radius?: number;
  fit?: 'cover' | 'contain';
  stripedPlaceholder?: boolean;
  /** Explicit non-photo placeholder for listings whose source has no image. */
  fallbackGlyph?: GlyphName;
  fallbackLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const colors = useThemeColors();
  const frame = radius > 0 ? {borderWidth:1,borderColor:colors['edge-faint']} : {};
  const [failedUri,setFailedUri]=useState<string|null>(null);
  if (!uri || failedUri===uri) {
    if(fallbackGlyph)return <View accessible accessibilityRole="image" accessibilityLabel={fallbackLabel} testID="place-photo-fallback"
      style={[frame,{borderRadius:radius,overflow:'hidden',backgroundColor:colors['surface-soft'],alignItems:'center',justifyContent:'center'},style]}>
      <Glyph name={fallbackGlyph} size={23} color={colors['fg-muted']} />{children}
    </View>;
    if (!stripedPlaceholder) {
      return <View style={[frame,{ borderRadius: radius, overflow: 'hidden', backgroundColor: colors.shell }, style]}>{children}</View>;
    }
    return (
      <Stripes radius={radius} style={[frame,style]}>
        {children}
      </Stripes>
    );
  }
  return (
    <View style={[frame,{ position: 'relative', borderRadius: radius, overflow: 'hidden', backgroundColor: colors.shell }, style]}>
      {stripedPlaceholder ? (
        <Stripes radius={radius} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
      <Image
        source={{ uri }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit={fit}
        transition={200}
        cachePolicy="memory-disk"
        onError={fallbackGlyph?()=>setFailedUri(uri):undefined}
      />
      {children}
    </View>
  );
}
