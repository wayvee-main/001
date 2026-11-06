import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { WALK_BUDGETS, type WalkBudget } from '@/lib/arrival';
import { useAurora } from '@/lib/aurora';
import { useThemeColors } from '@/lib/theme';

const THUMB = 30;

const stopLabel = (stop: WalkBudget) => (stop === null ? 'Any' : `${stop} min`);
const valueLabel = (stop: WalkBudget) => (stop === null ? 'Any distance' : `${stop} min`);

/** "Walk up to" — a slider that snaps to 5, 10, 15, 20 and 30 minutes or Any.
 * The chosen value rides above the thumb, so it is never printed twice.
 * Distance only ever sorts; it never hides a place (CLAUDE.md #2). */
export function WalkSlider({ value, onChange }: { value: WalkBudget; onChange: (value: WalkBudget) => void }) {
  const colors = useThemeColors(), aurora = useAurora();
  const [width, setWidth] = useState(0);
  const track = useRef<View>(null);
  const trackLeft = useRef(0);
  const index = Math.max(0, WALK_BUDGETS.indexOf(value));
  const step = WALK_BUDGETS.length - 1;
  const x = width ? (index / step) * width : 0;

  const pick = (nextIndex: number) => {
    const next = WALK_BUDGETS[Math.min(step, Math.max(0, nextIndex))];
    if (next !== value) onChange(next);
  };
  const pickAt = (event: GestureResponderEvent) => {
    if (!width) return;
    pick(Math.round(((event.nativeEvent.pageX - trackLeft.current) / width) * step));
  };
  // Measure on touch, not on layout: the sheet slides in, so a position
  // captured at layout time is where the track was mid-animation.
  const grant = (event: GestureResponderEvent) => {
    const pageX = event.nativeEvent.pageX;
    track.current?.measure((_x, _y, _w, _h, left) => {
      trackLeft.current = left;
      pickAt({ nativeEvent: { pageX } } as GestureResponderEvent);
    });
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const ring = aurora.scheme === 'dark' ? colors.accent : colors['pill-ink'];

  return (
    <View
      testID="walk-slider"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Walk up to"
      accessibilityValue={{ text: valueLabel(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => pick(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={{ marginTop: 34, marginHorizontal: 12 }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={pickAt}>
      <View ref={track} onLayout={onLayout} style={{ height: 30, justifyContent: 'center' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors['surface-sunk'], borderWidth: 1, borderColor: aurora.glassEdge, overflow: 'hidden' }}>
          <LinearGradient colors={[...aurora.fill]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: x }} />
        </View>
        {width ? WALK_BUDGETS.map((stop, i) => (
          <View key={String(stop)} pointerEvents="none" style={{
            position: 'absolute', left: (i / step) * width - 3, width: 6, height: 6, borderRadius: 3,
            backgroundColor: i <= index ? '#FFFFFF' : colors['fg-muted'], opacity: i <= index ? 0.9 : 0.35,
          }} />
        )) : null}
        {width ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: x - THUMB / 2, width: THUMB, height: THUMB }}>
            <View style={{ position: 'absolute', bottom: THUMB + 8, left: THUMB / 2 - 60, width: 120, alignItems: 'center' }}>
              <View style={{ borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 }}>
                <LinearGradient colors={[...aurora.fill]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
                <Text selectable={false} className="font-dm-bold" style={{ fontSize: 12, lineHeight: 16, color: aurora.onFill }}>{valueLabel(value)}</Text>
              </View>
              <View style={{ width: 8, height: 8, marginTop: -4, transform: [{ rotate: '45deg' }], backgroundColor: aurora.fill[1], borderRadius: 1 }} />
            </View>
            <View style={{
              width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: ring,
              boxShadow: '0 8px 18px -6px rgba(40, 20, 90, 0.45)',
            }} />
          </View>
        ) : null}
      </View>
      <View style={{ height: 16, marginTop: 12 }}>
        {width ? WALK_BUDGETS.map((stop, i) => (
          <Text key={String(stop)} selectable={false} className={i === index ? 'font-dm-bold' : 'font-dm-medium'} numberOfLines={1}
            style={{ position: 'absolute', left: (i / step) * width - 30, width: 60, textAlign: 'center', fontSize: 11, lineHeight: 15, color: i === index ? colors.fg : colors['fg-muted'] }}>
            {stopLabel(stop)}
          </Text>
        )) : null}
      </View>
    </View>
  );
}
