import { useWindowDimensions } from 'react-native';

/** The screen's side gutter. Lives apart from components/layout so small
 * components can use it without pulling in the navigation and its animation
 * runtime. */
export function useAppGutter(): number {
  const { width } = useWindowDimensions();
  return width <= 360 ? 13 : width <= 430 ? 17 : 24;
}
