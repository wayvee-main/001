import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cssInterop } from 'react-native-css-interop';
import { AuroraEntryCard, GradientText, SectionRule } from '@/components/aurora';
import { gradientColors } from '@/lib/aurora';
import { useThemeColors } from '@/lib/theme';
import { AURORA, ROLES } from '@/lib/tokens';

const mockPush = jest.fn(), mockToggleSaved = jest.fn(), mockToggleStop = jest.fn(), mockShowToast = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/theme', () => ({ useThemeColors: jest.fn() }));
jest.mock('@/components/glyph', () => ({ Glyph: () => null }));
jest.mock('@/lib/city', () => ({ useActiveCity: () => 'oakland', useActiveCityName: () => 'Oakland' }));
jest.mock('@/lib/home-index-photos', () => ({ homeIndexPhotos: () => [] }));
jest.mock('@/lib/local-perks-store', () => {
  const state = { stops: [], date: '', toggleStop: (...args) => mockToggleStop(...args) };
  return { useLocalPerks: selector => selector ? selector(state) : state };
});
jest.mock('@/lib/store', () => {
  const state = { deviceLocation: null, showToast: (...args) => mockShowToast(...args), isSaved: () => false, toggleSaved: (...args) => mockToggleSaved(...args) };
  return { useScoper: selector => selector ? selector(state) : state };
});

for (const component of [Pressable, Text, View]) cssInterop(component, { className: 'style' });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const catalog = { entries: {}, categories: { eat: [], bars: [], routes: [], events: [] }, collections: [] };
const entry = { kind: 'place', id: 'little-bird', name: 'Little Bird', caption: 'Neighborhood cocktail bar', glyph: 'drink', facts: [], saveKind: 'place' };

let trees = [];
function mount(element) { let tree; act(() => { tree = renderer.create(element); }); trees.push(tree); return tree; }
function nodes(tree) {
  const result = [];
  const walk = value => { if (!value || typeof value === 'string') return; if (Array.isArray(value)) { value.forEach(walk); return; } result.push(value); value.children?.forEach(walk); };
  walk(tree.toJSON()); return result;
}
const pressable = (tree, id) => tree.root.findAll(node => node.props.testID === id && typeof node.props.onPress === 'function')[0];
afterEach(() => { act(() => trees.forEach(tree => tree.unmount())); trees = []; jest.clearAllMocks(); });
beforeEach(() => {
  useThemeColors.mockReturnValue(Object.fromEntries(Object.entries(ROLES).map(([key, value]) => [key, value.light])));
});

describe('Aurora primitives (native)', () => {
  it('colors a headline phrase glyph by glyph along the text gradient, inside one sentence', () => {
    const tree = mount(<Text testID="headline">Go on. <GradientText text="Make a day" /></Text>);
    const spans = tree.root.findByProps({ testID: 'headline' }).findAll(node => node.type === Text && node.props.style?.color);
    const expected = gradientColors(AURORA.light.text, 'Make a day'.length);
    expect(spans.map(span => span.props.style.color)).toEqual(expected);
    expect(spans.map(span => span.props.children).join('')).toBe('Make a day');
  });
  it('draws a hairline section rule with spacing on both sides', () => {
    const tree = mount(<SectionRule spacing={12} />);
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'section-rule' }).props.style)).toMatchObject({ height: 1, marginVertical: 12, backgroundColor: AURORA.light.rule });
  });
  it('keeps a card’s real destination, save and add-to-evening actions', () => {
    const tree = mount(<AuroraEntryCard entry={entry} catalog={catalog} width={200} height={250} />);
    expect(StyleSheet.flatten(nodes(tree).find(node => node.props.testID === 'aurora-entry-card-frame').props.style)).toMatchObject({ width: 200, height: 250, overflow: 'hidden' });
    act(() => pressable(tree, 'aurora-entry-card').props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=little-bird');
    act(() => pressable(tree, 'perks-save-place').props.onPress());
    expect(mockToggleSaved).toHaveBeenCalledWith('place', 'little-bird', 'Little Bird');
    act(() => pressable(tree, 'perks-add-stop').props.onPress());
    expect(mockToggleStop).toHaveBeenCalledWith(expect.objectContaining({ kind: 'place', id: 'little-bird', city: 'oakland' }));
    expect(mockShowToast).toHaveBeenCalledWith('One good stop, kept in mind.');
  });
});
