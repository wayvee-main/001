import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

/** Inline native controls must keep React Native's style callback intact.
 * NativeWind v4's native interop flattens that function into an empty object.
 * Child Text/View components still resolve their own NativeWind classes.
 * Use an ordinary Pressable when the control itself needs className. */
export const NativePressable = forwardRef<View, Omit<PressableProps, 'className'>>(
  function NativePressable(props, ref) {
    return <Pressable {...props} ref={ref} cssInterop={false} />;
  },
);
