import type { TextStyle } from 'react-native';

/** Section headings are set in Fraunces italic; everything else stays in
 * Outfit. The two italic cuts are loaded in app/_layout.tsx under these names,
 * which is what fontFamily has to match on native and web alike. */
export const HEADING_FONT = 'Fraunces_500MediumItalic';
export const HEADING_STRONG_FONT = 'Fraunces_600SemiBoldItalic';

/** A section heading ("Start here", "On the bill", …). `strong` is for the
 * larger chapter titles on Discover (Eat, Go out, Drink, Wander). */
export function headingStyle(size = 23, strong = false): TextStyle {
  return {
    fontFamily: strong ? HEADING_STRONG_FONT : HEADING_FONT,
    fontSize: size,
    lineHeight: Math.round(size * 1.18),
    letterSpacing: strong ? -0.6 : -0.3,
  };
}
