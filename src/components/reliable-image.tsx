import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glyph } from '@/components/glyph';
import { NativePressable } from '@/components/native-pressable';
import { useThemeColors } from '@/lib/theme';

export type PhotoCandidate = { source: string | number; label?: string };
export const PHOTO_LOAD_TIMEOUT_MS = 12_000;

type Props = {
  candidates: readonly PhotoCandidate[]; label: string; fallbackGlyph?: string;
  fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle>; placeholder?: ReactNode;
  children?: ReactNode; onUnavailable?: () => void; testID?: string;
  /** Ink for the placeholder glyph and Retry label, for photos that sit on a dark fallback. */
  inkColor?: string;
  /** False inside another control (a card or row): a failed photo shows its placeholder
   * glyph instead of a nested Retry button, which web cannot nest inside a button. */
  retryable?: boolean;
};

/** A new source list gets an independent session, so late events from an old
 * venue cannot skip a new venue's photo or leave a cached bitmap invisible. */
export function ReliableImage(props: Props) {
  const seen = new Set<string>();
  const candidates = props.candidates.filter(photo => {
    const key = JSON.stringify(photo.source);
    if (!photo.source || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 8);
  return <ImageSession key={JSON.stringify([props.label, candidates])} {...props} candidates={candidates} />;
}

function ImageSession({ candidates, label, fallbackGlyph = 'landmark', fit = 'cover', style, placeholder, children, onUnavailable, testID = 'reliable-image', inkColor, retryable = true }: Props) {
  const colors = useThemeColors(), notified = useRef(false), ink = inkColor || colors['fg-muted'];
  const deadline = useRef<{ token: string; bytes: number; refresh: () => void } | undefined>(undefined);
  const [attempt, setAttempt] = useState({ index: 0, revision: 0, ready: false });
  const { index, revision, ready } = attempt, photo = candidates[index], hasPhoto = Boolean(photo), token = `${revision}:${index}`;
  const settle = () => setAttempt(current => current.index === index && current.revision === revision && !current.ready ? { ...current, ready: true } : current);
  const fail = () => setAttempt(current => current.index === index && current.revision === revision ? { ...current, index: current.index + 1, ready: false } : current);

  useEffect(() => {
    if (!hasPhoto || ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const arm = () => {
      clearTimeout(timer);
      if (active) timer = setTimeout(() => setAttempt(current => current.index === index && current.revision === revision && !current.ready
        ? { ...current, index: current.index + 1, ready: false } : current), PHOTO_LOAD_TIMEOUT_MS);
    };
    deadline.current = { token, bytes: 0, refresh: arm };
    arm();
    const subscription = AppState.addEventListener('change', state => { active = state === 'active'; arm(); });
    return () => { clearTimeout(timer); deadline.current = undefined; subscription.remove(); };
  }, [hasPhoto, index, ready, revision, token]);

  useEffect(() => {
    if (!photo && !notified.current) { notified.current = true; onUnavailable?.(); }
  }, [onUnavailable, photo]);

  const retry = () => { notified.current = false; setAttempt(current => ({ index: 0, revision: current.revision + 1, ready: false })); };
  const glyph = <Glyph name={fallbackGlyph} size={23} color={ink} />;
  const missing = candidates.length === 0;
  return <View testID={`${testID}-frame`} style={[{ position: 'relative', overflow: 'hidden', backgroundColor: colors['surface-soft'] }, style]}>
    {!ready ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {photo ? placeholder || glyph : missing || !retryable ? <View accessibilityRole="image" accessible accessibilityLabel={label}>{glyph}</View> :
        <NativePressable testID={`${testID}-retry`} accessibilityRole="button" accessibilityLabel={`Retry photo. ${label}`} onPress={retry}
          style={{ width: '100%', height: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Glyph name="refresh" size={20} color={ink} /><Text className="font-dm" style={{ fontSize: 11, lineHeight: 14, color: ink }}>Retry</Text>
        </NativePressable>}
    </View> : null}
    {photo ? <Image key={token} testID={testID} accessibilityLabel={photo.label || 'Photograph'}
      source={typeof photo.source === 'string' ? { uri: photo.source } : photo.source} recyclingKey={`${JSON.stringify(photo.source)}:${token}`}
      contentFit={fit} cachePolicy="memory-disk" transition={150} style={StyleSheet.absoluteFill}
      onLoad={settle} onDisplay={settle} onError={fail}
      onProgress={event => { const current = deadline.current; if (current?.token === token && event.loaded > current.bytes) { current.bytes = event.loaded; current.refresh(); } }} /> : null}
    {children}
  </View>;
}
