// Reduced-motion, read once and kept live.
//
// This lived inside create.tsx while the composer was the only animated
// surface. The constraint picker moved out into its own component, and a
// component cannot import a hook from a screen — so the hook comes here, where
// both the screen and the component can reach it.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotionPreference(): boolean {
  // Start conservatively. This resolves while the primary layer is visible,
  // well before most guests open the focused composer.
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
