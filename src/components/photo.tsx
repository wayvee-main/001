import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { Stripes } from '@/components/ui';
import { type GlyphName } from '@/components/glyph';
import { ReliableImage, type PhotoCandidate } from '@/components/reliable-image';
import { useThemeColors } from '@/lib/theme';

/**
 * Remote photo with the design's striped placeholder underneath —
 * shown while loading and kept if the image fails (offline, dead URL).
 */
export function Photo({
  uri,
  source,
  candidates = [],
  radius = 12,
  fit = 'cover',
  stripedPlaceholder = true,
  fallbackGlyph,
  fallbackLabel = 'Photo unavailable',
  style,
  children,
  onUnavailable,
  inkColor,
  retryable,
}: {
  uri?: string;
  source?: number;
  candidates?: readonly PhotoCandidate[];
  radius?: number;
  fit?: 'cover' | 'contain';
  stripedPlaceholder?: boolean;
  /** Explicit non-photo placeholder for listings whose source has no image. */
  fallbackGlyph?: GlyphName;
  fallbackLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onUnavailable?: () => void;
  /** Placeholder ink for photos laid over a dark fallback (overlay cards). */
  inkColor?: string;
  /** See ReliableImage: false when the photo sits inside another control. */
  retryable?: boolean;
}) {
  const colors = useThemeColors();
  const frame = radius > 0 ? {borderWidth:1,borderColor:colors['edge-card'],borderBottomColor:colors['edge-card-bottom']} : {};
  const sources = [...(source ? [{ source }] : []), ...candidates, ...(uri ? [{ source: uri }] : [])];
  return <ReliableImage candidates={sources} label={fallbackLabel} fallbackGlyph={fallbackGlyph} fit={fit} onUnavailable={onUnavailable} inkColor={inkColor} retryable={retryable}
    style={[frame, { borderRadius: radius, backgroundColor: colors.shell }, style]}
    placeholder={stripedPlaceholder ? <Stripes radius={radius} style={{ width: '100%', height: '100%' }} /> : undefined}>
    {children}
  </ReliableImage>;
}
