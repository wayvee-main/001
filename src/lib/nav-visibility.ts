import { makeMutable, withTiming } from 'react-native-reanimated';

/** How far the navigation is tucked away: 0 shown, 1 gone.
 *
 * A module-level shared value rather than context, because the two ends live
 * in different trees — ScreenScroll is inside the screen, EditorialNav is
 * mounted beside it by the tab layout — and a re-render per scroll frame is
 * exactly what this is trying to avoid.
 *
 * The bar is a floating pill over the scroll view. Reserved padding keeps the
 * LAST item clear of it, but nothing can stop everything else passing beneath
 * on the way past; so it leaves while you are reading and comes back the
 * moment you reach for it.
 */
export const navHidden = makeMutable(0);

/** Below this the bar is always shown: at the top of a screen there is nothing
 * to read behind it, and a bar that hides at rest feels broken. */
const ALWAYS_SHOWN_ABOVE = 24;
/** Ignore the jitter of a finger resting on the glass. */
const DIRECTION_THRESHOLD = 10;
const DURATION = 180;

let lastOffset = 0;
/** The value we are animating toward, which `navHidden.value` is not: mid
 * flight it is a fraction, so comparing against it would re-fire every frame. */
let target = 0;

function settle(next: 0 | 1) {
  if (target === next) return;
  target = next;
  navHidden.value = withTiming(next, { duration: DURATION });
}

export function reportNavScroll(offset: number) {
  if (offset <= ALWAYS_SHOWN_ABOVE) {
    lastOffset = offset;
    settle(0);
    return;
  }
  const delta = offset - lastOffset;
  if (Math.abs(delta) < DIRECTION_THRESHOLD) return;
  lastOffset = offset;
  settle(delta > 0 ? 1 : 0);
}

/** Called when a tab screen takes focus. Without it, leaving one screen
 * scrolled down would hand the next screen a hidden bar. */
export function resetNavVisibility() {
  lastOffset = 0;
  target = 0;
  navHidden.value = withTiming(0, { duration: DURATION });
}
