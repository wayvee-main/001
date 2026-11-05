import { describe, expect, it } from '@jest/globals';

import { gradientColors, pulseRanges } from '@/lib/aurora';
import { AURORA } from '@/lib/tokens';

describe('gradientColors', () => {
  it('starts and ends on the outer stops and passes through the middle one', () => {
    const colors = gradientColors(AURORA.light.text, 5);
    expect(colors).toHaveLength(5);
    expect(colors[0]).toBe(AURORA.light.text[0]);
    expect(colors[2]).toBe(AURORA.light.text[1]);
    expect(colors[4]).toBe(AURORA.light.text[2]);
  });
  it('handles one glyph and an empty phrase', () => {
    expect(gradientColors(AURORA.dark.text, 1)).toEqual([AURORA.dark.text[0]]);
    expect(gradientColors(AURORA.dark.text, 0)).toEqual([]);
  });
});

describe('pulseRanges', () => {
  it('peaks at the phase and dims half a cycle later', () => {
    const { inputRange, outputRange } = pulseRanges(0, 0.35);
    expect(inputRange[0]).toBe(0);
    expect(inputRange[inputRange.length - 1]).toBe(1);
    expect(outputRange[0]).toBeCloseTo(1);
    expect(outputRange[inputRange.indexOf(0.5)]).toBeCloseTo(0.35);
    expect(Math.min(...outputRange)).toBeGreaterThanOrEqual(0.35 - 1e-9);
  });
  it('shifts the peak with the phase so bolts ripple', () => {
    const { inputRange, outputRange } = pulseRanges(0.25, 0.35);
    expect(outputRange[inputRange.indexOf(0.25)]).toBeCloseTo(1);
    expect(outputRange[inputRange.indexOf(0.75)]).toBeCloseTo(0.35);
  });
});
