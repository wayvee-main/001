import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cssInterop } from 'react-native-css-interop';
import { EditorialNav } from '@/components/editorial-nav';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksBanners, LocalPerksCard, PerksRoundButton } from '@/components/local-perks';
import { useReducedMotionPreference } from '@/lib/motion';
import { useThemeColors } from '@/lib/theme';
import { ROLES } from '@/lib/tokens';

const mockPush = jest.fn();
const mockOpenOffer = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: callback => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }) }));
jest.mock('@/lib/theme', () => ({ useThemeColors: jest.fn() }));
jest.mock('@/lib/shadows', () => ({ useControlSurface: () => ({ borderWidth: 1 }), useRaisedSurface: () => ({ borderWidth: 1 }) }));
jest.mock('@/components/glyph', () => ({ Glyph: () => null }));
jest.mock('@/components/vee-mark', () => ({ VeeMark: () => null }));
jest.mock('@/lib/city', () => ({ useActiveCity: () => 'oakland', useActiveCityName: () => 'Oakland' }));
jest.mock('@/lib/clock', () => ({ useNow: () => new Date(2026, 10, 3, 19) }));
jest.mock('@/lib/weather', () => ({ useWeatherNow: () => null, weatherLine: () => '' }));
jest.mock('@/lib/motion', () => ({ useReducedMotionPreference: jest.fn(() => true) }));
jest.mock('@/lib/home-index-photos', () => ({ homeIndexPhotos: () => [] }));
jest.mock('@/lib/local-perks-store', () => {
  const state = { stops: [], date: '', openOffer: (...args) => mockOpenOffer(...args), toggleStop: jest.fn() };
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
const freshEntry = { ...entry, category: 'cafe', detailContent: { version: 1, sourceUrl: 'https://cafe.example/menu', verifiedAt: new Date(2026, 10, 2).toISOString(),
  menu: { url: 'https://cafe.example/menu', items: [{ name: 'Morning toast', categories: ['Breakfast'] }, { name: 'Noodles', categories: ['Dinner'] }] } } };
const freshCatalog = { ...empty, entries: { 'place:source-cafe': freshEntry } };
const offerCatalog = { ...empty, entries: { 'place:source-cafe': { ...freshEntry, detailContent: { ...freshEntry.detailContent,
  offers: [{ title: 'Dinner special', label: 'Daily', description: 'Venue listed', url: 'https://cafe.example/special' }] } } } };
const refreshedCatalog = { ...offerCatalog, entries: { 'place:source-cafe': { ...offerCatalog.entries['place:source-cafe'], detailContent: { ...offerCatalog.entries['place:source-cafe'].detailContent, offers: [{ title: 'New offer', label: 'Daily', description: 'Venue listed', url: 'https://cafe.example/new' }, ...offerCatalog.entries['place:source-cafe'].detailContent.offers] } } } };
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
afterEach(() => { act(() => trees.forEach(tree => tree.unmount())); trees = []; jest.restoreAllMocks(); });

describe.each(['light', 'dark'])('Local Perks native layout in %s', theme => {
  const ribbon = theme === 'light' ? '#EBD4BD' : '#2C222C';
  beforeEach(() => {
    mockPush.mockClear();
    mockOpenOffer.mockClear();
    useReducedMotionPreference.mockReturnValue(true);
    useThemeColors.mockReturnValue({ ...Object.fromEntries(Object.entries(ROLES).map(([key, value]) => [key, value[theme]])), fg: '#2D2925', 'fg-muted': '#64584F', 'accent-fill': '#AE512E', 'fg-accent': '#98431F', 'surface-control': '#FFFFFF', 'surface-ribbon': ribbon, 'ribbon-ink': '#3D2B20', 'surface-navigation': '#FFFCF7' });
  });

  it('retains round action sizing', () => {
    const tree = mount(<PerksRoundButton testID="round" label="Offers" glyph="tag" onPress={() => {}} />);
    expect(style(tree, 'round')).toMatchObject({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' });
  });
  it('keeps both ribbon sizes and their theme fill', () => {
    for (const compact of [false, true]) {
      const tree = mount(<LocalPerksBanners catalog={empty} compact={compact} />);
      expect(tree.root.findAllByProps({ testID: 'perks-banner-vee' })).toHaveLength(0);
      expect(style(tree, 'perks-banner-stay')).toMatchObject({ height: compact ? 100 : 110, flexDirection: 'row', borderRadius: 18, backgroundColor: ribbon });
    }
  });
  it('keeps row alignment and overlays separate save/add actions', () => {
    const tree = mount(<LocalPerksCard entry={entry} catalog={empty} />);
    expect(style(tree, 'perks-place-open')).toMatchObject({ flexDirection: 'row', minHeight: 100, padding: 9 });
    expect(style(tree, 'perks-save-place')).toMatchObject({ position: 'absolute', top: 11, right: 11, width: 30, height: 30 });
    expect(style(tree, 'perks-add-stop')).toMatchObject({ position: 'absolute', bottom: 10, right: 11, width: 28, height: 28 });
  });
  it('uses regular inline metadata pills and keeps rail actions off the facts', () => {
    const source = { ...freshEntry, facts: [{ glyph: 'pin', value: '<0.1 mi' }], detailContent: offerCatalog.entries['place:source-cafe'].detailContent };
    const tree = mount(<LocalPerksCard entry={source} catalog={empty} format="rail" width={280} />);
    expect(nodes(tree).filter(node => node.props.testID === 'card-photo-label')).toHaveLength(1);
    const pills = nodes(tree).filter(node => /^card-metadata-(pin:0|menu|offer)$/.test(node.props.testID || ''));
    expect(pills).toHaveLength(3);
    for (const pill of pills) expect(StyleSheet.flatten(pill.props.style)).toMatchObject({ height: 32, flex: 1, flexDirection: 'row', borderRadius: 999 });
    expect(style(tree, 'card-metadata-pin:0').backgroundColor).toBe(ROLES['metadata-distance'][theme]);
    expect(style(tree, 'card-metadata-menu').backgroundColor).toBe(ROLES['metadata-menu'][theme]);
    expect(style(tree, 'card-metadata-offer').backgroundColor).toBe(ROLES['metadata-offer'][theme]);
    expect(style(tree, 'perks-add-stop')).toMatchObject({ top: 106, right: 18 });
    expect(style(tree, 'perks-add-stop').bottom).toBeUndefined();
  });
  it('keeps four equally sized navigation tabs', () => {
    const items = ['index', 'discover', 'create', 'profile'].map(key => ({ key, label: key, glyph: 'home', selected: key === 'index', onPress: () => {} }));
    const tree = mount(<EditorialNav items={items} />), tabs = nodes(tree).filter(node => node.props.accessibilityRole === 'tab');
    expect(tabs).toHaveLength(4);
    tabs.forEach(tab => expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ flex: 1, minHeight: 47, alignItems: 'center' }));
  });
  it('preserves native pill touch targets and each separate category destination', () => {
    const tree = mount(<LocalCategoryShelf catalog={empty} />);
    for (const category of ['eat', 'bars', 'routes', 'events']) {
      expect(style(tree, `home-category-${category}`)).toMatchObject({ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 999 });
      act(() => tree.root.findByProps({ testID: `home-category-${category}` }).props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith('/home/' + category);
    }
  });
  it('updates named menu picks by daypart and opens the actual dish', () => {
    const tree = mount(<HomeTimelyRecommendations catalog={freshCatalog} now={new Date(2026, 10, 3, 8)} />);
    const morning = tree.root.findByProps({ testID: 'home-recommendation-dish:place:source-cafe:morningtoast' });
    act(() => morning.props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=source-cafe&dish=Morning%20toast');
    act(() => tree.update(<HomeTimelyRecommendations catalog={freshCatalog} now={new Date(2026, 10, 3, 19)} />));
    expect(tree.root.findAllByProps({ testID: 'home-recommendation-dish:place:source-cafe:morningtoast' })).toHaveLength(0);
    act(() => tree.root.findByProps({ testID: 'home-recommendation-dish:place:source-cafe:noodles' }).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=source-cafe&dish=Noodles');
    const dots = nodes(tree).filter(node => node.props.testID === 'home-recommendation-pulse');
    expect(dots).toHaveLength(1);
    expect(StyleSheet.flatten(dots[0].props.style).backgroundColor).toBe(ribbon);
  });
  it('shows an honest empty state when no recent source exists', () => {
    const tree = mount(<HomeTimelyRecommendations catalog={empty} now={new Date(2026, 10, 3, 19)} />);
    expect(tree.root.findByProps({ testID: 'home-recommendations-empty' })).toBeDefined();
    expect(tree.root.findAllByProps({ testID: 'home-recommendation-pulse' })).toHaveLength(0);
  });
  it('keeps the visible banner through refreshes and finishes an in-progress swipe', () => {
    const tree = mount(<LocalPerksBanners catalog={offerCatalog} />);
    const scroll = () => tree.root.findByProps({ testID: 'perks-banner-scroll' });
    const position = () => tree.root.findByProps({ testID: 'perks-banner-position' }).props.accessibilityValue;
    const nativeScroll = tree.root.findByType(ScrollView).instance;
    const scrollTo = jest.spyOn(nativeScroll, 'scrollTo');
    expect(StyleSheet.flatten(scroll().props.contentContainerStyle).gap).toBe(12);
    expect(scroll().props.snapToInterval).toBe(312);
    act(() => scroll().props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 312 } } }));
    expect(position().now).toBe(2);
    act(() => tree.update(<LocalPerksBanners catalog={refreshedCatalog} />));
    expect(position().now).toBe(3);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 624, animated: false });
    act(() => tree.update(<LocalPerksBanners catalog={offerCatalog} />));
    act(() => scroll().props.onScrollBeginDrag());
    scrollTo.mockClear();
    act(() => tree.update(<LocalPerksBanners catalog={refreshedCatalog} />));
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => scroll().props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 0 } } }));
    expect(position().now).toBe(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 312, animated: false });
    expect(nodes(tree).filter(node => node.props.accessibilityRole === 'button' && /^(Next|Previous) banner$/.test(node.props.accessibilityLabel || ''))).toHaveLength(0);
  });
  it('does not open a banner when releasing a swipe', () => {
    const tree = mount(<LocalPerksBanners catalog={offerCatalog} />);
    act(() => tree.root.findByProps({ testID: 'perks-banner-scroll' }).props.onScrollBeginDrag());
    act(() => tree.root.findByProps({ testID: 'perks-banner-offer' }).props.onPress());
    expect(mockOpenOffer).not.toHaveBeenCalled();
  });
  it('pauses the pulse for reduced motion, backgrounding and leaving Home', () => {
    let appStateChanged;
    const remove = jest.fn(), start = jest.fn(), stop = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => { appStateChanged = listener; return { remove }; });
    const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop });
    const now = new Date(2026, 10, 3, 12), tree = mount(<HomeTimelyRecommendations catalog={freshCatalog} now={now} />);
    expect(loop).not.toHaveBeenCalled();
    useReducedMotionPreference.mockReturnValue(false);
    act(() => tree.update(<HomeTimelyRecommendations catalog={freshCatalog} now={now} />));
    expect(start).toHaveBeenCalledTimes(1);
    act(() => appStateChanged('background'));
    expect(stop).toHaveBeenCalledTimes(1);
    act(() => appStateChanged('active'));
    expect(start).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
    trees = trees.filter(item => item !== tree);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalled();
  });
});
