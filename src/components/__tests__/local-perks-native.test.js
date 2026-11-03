import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cssInterop } from 'react-native-css-interop';
import { EditorialNav } from '@/components/editorial-nav';
import { LocalPerksBanners, LocalPerksCard, PerksRoundButton } from '@/components/local-perks';
import { useThemeColors } from '@/lib/theme';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }) }));
jest.mock('@/lib/theme', () => ({ useThemeColors: jest.fn() }));
jest.mock('@/lib/shadows', () => ({ useControlSurface: () => ({ borderWidth: 1 }), useRaisedSurface: () => ({ borderWidth: 1 }) }));
jest.mock('@/components/glyph', () => ({ Glyph: () => null }));
jest.mock('@/components/vee-mark', () => ({ VeeMark: () => null }));
jest.mock('@/lib/city', () => ({ useActiveCity: () => 'oakland', useActiveCityName: () => 'Oakland' }));
jest.mock('@/lib/clock', () => ({ useNow: () => new Date(2026, 10, 3, 19) }));
jest.mock('@/lib/weather', () => ({ useWeatherNow: () => null, weatherLine: () => '' }));
jest.mock('@/lib/home-index-photos', () => ({ homeIndexPhotos: () => [] }));
jest.mock('@/lib/local-perks-store', () => {
  const state = { stops: [], date: '', openOffer: jest.fn(), toggleStop: jest.fn() };
  return { useLocalPerks: selector => selector ? selector(state) : state };
});
jest.mock('@/lib/store', () => {
  const state = { deviceLocation: null, openStaySheet: jest.fn(), showToast: jest.fn(), isSaved: () => false, toggleSaved: jest.fn() };
  return { useScoper: selector => selector ? selector(state) : state };
});

// Exercise the native production interop path. Default Jest does not register
// these wrappers, which is why web renders and data-only tests missed the bug.
for (const component of [Pressable, Text, View]) cssInterop(component, { className: 'style' });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const empty = { entries: {}, categories: { eat: [], bars: [], routes: [], events: [] }, collections: [] };
const entry = { kind: 'place', id: 'source-cafe', name: 'Source café', caption: 'Café', glyph: 'coffee', facts: [], saveKind: 'place' };
let trees = [];
function mount(element) {
  let tree; act(() => { tree = renderer.create(element); }); trees.push(tree); return tree;
}
function nodes(tree) {
  const result = [];
  const walk = value => { if (!value || typeof value === 'string') return; if (Array.isArray(value)) { value.forEach(walk); return; } result.push(value); value.children?.forEach(walk); };
  walk(tree.toJSON()); return result;
}
const style = (tree, id) => StyleSheet.flatten(nodes(tree).find(node => node.props.testID === id)?.props.style);
afterEach(() => { act(() => trees.forEach(tree => tree.unmount())); trees = []; });

describe.each(['light', 'dark'])('Local Perks native layout in %s', theme => {
  const ribbon = theme === 'light' ? '#EBD4BD' : '#2C222C';
  beforeEach(() => useThemeColors.mockReturnValue({ fg: '#2D2925', 'fg-muted': '#64584F', 'accent-fill': '#AE512E', 'fg-accent': '#98431F', 'surface-control': '#FFFFFF', 'surface-ribbon': ribbon, 'ribbon-ink': '#3D2B20', 'surface-navigation': '#FFFCF7' }));

  it('retains round action sizing', () => {
    const tree = mount(<PerksRoundButton testID="round" label="Offers" glyph="tag" onPress={() => {}} />);
    expect(style(tree, 'round')).toMatchObject({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' });
  });
  it('keeps both ribbon sizes and their theme fill', () => {
    for (const compact of [false, true]) {
      const tree = mount(<LocalPerksBanners catalog={empty} compact={compact} />);
      expect(style(tree, 'perks-banner-vee')).toMatchObject({ height: compact ? 100 : 110, flexDirection: 'row', borderRadius: 18, backgroundColor: ribbon });
    }
  });
  it('keeps row alignment and overlays separate save/add actions', () => {
    const tree = mount(<LocalPerksCard entry={entry} catalog={empty} />);
    expect(style(tree, 'perks-place-open')).toMatchObject({ flexDirection: 'row', minHeight: 100, padding: 9 });
    expect(style(tree, 'perks-save-place')).toMatchObject({ position: 'absolute', top: 11, right: 11, width: 30, height: 30 });
    expect(style(tree, 'perks-add-stop')).toMatchObject({ position: 'absolute', bottom: 10, right: 11, width: 28, height: 28 });
  });
  it('keeps four equally sized navigation tabs', () => {
    const items = ['index', 'discover', 'create', 'profile'].map(key => ({ key, label: key, glyph: 'home', selected: key === 'index', onPress: () => {} }));
    const tree = mount(<EditorialNav items={items} />), tabs = nodes(tree).filter(node => node.props.accessibilityRole === 'tab');
    expect(tabs).toHaveLength(4);
    tabs.forEach(tab => expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ flex: 1, minHeight: 47, alignItems: 'center' }));
  });
});
