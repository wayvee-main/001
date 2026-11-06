import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cssInterop } from 'react-native-css-interop';
import { EditorialNav } from '@/components/editorial-nav';
import { AuroraEntryRow, AuroraLinkRow, AuroraList } from '@/components/aurora';
import { DaybreakPeriodPicker, DaybreakFeature } from '@/components/daybreak';
import { compactCardText, shortCardTitle } from '@/lib/card-presentation';
import { QuietHomeOffers, QuietHomeVee } from '@/components/quiet-home';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksBanners, LocalPerksCard, PerksRoundButton } from '@/components/local-perks';
import { useReducedMotionPreference } from '@/lib/motion';
import { useThemeColors } from '@/lib/theme';
import { ROLES } from '@/lib/tokens';

const mockPush = jest.fn();
const mockOpenOffer = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: callback => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }) }));
jest.mock('@/lib/theme', () => ({ useThemeColors: jest.fn() }));
jest.mock('@/lib/shadows', () => ({ useElevation: () => ({}), useControlSurface: () => ({ borderWidth: 1 }), useRaisedSurface: () => ({ borderWidth: 1 }) }));
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
const pressable = (tree, id) => tree.root.findAll(node => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const style = (tree, id) => StyleSheet.flatten(nodes(tree).find(node => node.props.testID === id)?.props.style);
afterEach(() => { act(() => trees.forEach(tree => tree.unmount())); trees = []; jest.restoreAllMocks(); });

describe.each(['light', 'dark'])('Local Perks native layout in %s', theme => {
  beforeEach(() => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    mockPush.mockClear();
    mockOpenOffer.mockClear();
    useReducedMotionPreference.mockReturnValue(true);
    useThemeColors.mockReturnValue({ ...Object.fromEntries(Object.entries(ROLES).map(([key, value]) => [key, value[theme]])), 'edge-card': 'rgba(90,60,40,.1)', 'edge-soft': 'rgba(90,60,40,.08)' });
  });

  it('opens the real venue from the Home poster and calm rows without nesting a retry', () => {
    const source = { ...freshEntry, description: 'A short source snapshot.', facts: [{ glyph: 'pin', value: '0.4 mi' }] };
    for (const [tree, id] of [[mount(<DaybreakFeature entry={source} catalog={empty} now={new Date(2026, 10, 3, 12)} />), 'daybreak-poster'],
      [mount(<AuroraEntryRow testID="daybreak-home-row" entry={source} catalog={empty} now={new Date(2026, 10, 3, 12)} />), 'daybreak-home-row']]) {
      expect(tree.root.findAllByProps({ testID: 'photo-retry' })).toHaveLength(0);
      act(() => pressable(tree, id).props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=source-cafe');
    }
  });
  it('keeps the extras ribbons thin and the planner and collection links functional', () => {
    for (const id of ['quiet-home-offers', 'home-evening-ribbon']) {
      const tree = mount(id === 'quiet-home-offers' ? <QuietHomeOffers /> : <QuietHomeVee />);
      expect(style(tree, id)).toMatchObject({ minHeight: 44, borderRadius: 13, flexDirection: 'row' });
      expect(style(tree, id).marginTop).toBeUndefined();
    }
    for (const [component, id, destination] of [
      [<QuietHomeOffers key="offers" />, 'quiet-home-offers', '/offers'],
      [<QuietHomeVee key="vee" />, 'home-evening-ribbon', '/create'],
      [<AuroraLinkRow key="collection" title="Source collection" glyph="bookmark" testID="quiet-link" onPress={() => mockPush('/home/collection?id=source')} />, 'quiet-link', '/home/collection?id=source'],
    ]) {
      const tree = mount(component);
      act(() => pressable(tree, id).props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith(destination);
    }
  });
  it('groups Home items in calm lists with one quiet fact line and no pills', () => {
    const tree = mount(<AuroraList testID="calm"><AuroraEntryRow testID="venue" entry={{ ...entry, facts: [{ glyph: 'pin', value: '<0.1 mi' }] }} catalog={empty} now={new Date(2026, 10, 3, 12)} />
      <AuroraLinkRow divider testID="idea" title="A timely idea" glyph="coffee" meta="4 picks · Tonight" onPress={() => {}} /></AuroraList>);
    expect(style(tree, 'calm')).toMatchObject({ borderRadius: 22, overflow: 'hidden', backgroundColor: ROLES['surface-raised'][theme] });
    expect(style(tree, 'venue')).toMatchObject({ minHeight: 64, flexDirection: 'row' });
    expect(style(tree, 'venue').borderTopWidth).toBe(0);
    expect(style(tree, 'idea').borderTopWidth).toBe(1);
    const lines = nodes(tree).filter(node => node.type === 'Text').map(node => (node.children || []).join(''));
    expect(lines).toEqual(expect.arrayContaining(['Café · 0.1 mi', '4 picks · Tonight']));
    expect(nodes(tree).filter(node => node.props.accessible && StyleSheet.flatten(node.props.style)?.borderRadius === 999)).toHaveLength(0);
    const route = mount(<AuroraEntryRow testID="route" entry={{ ...entry, kind: 'crawl', caption: '4 stops · cross-town · rides recommended', facts: [{ glyph: 'route', value: '4 stops' }] }} catalog={empty} now={new Date(2026, 10, 3, 12)} />);
    expect(nodes(route).some(node => node.type === 'Text' && (node.children || []).join('') === '4 stops · cross-town')).toBe(true);
  });
  it('caps the Golden Bears poster copy without changing its accessible venue record', () => {
    const name = 'California Golden Bears Football vs Stanford Cardinal Football';
    const description = 'An extended college football preview with schedules, team information, stadium details and additional venue information that belongs on the detail page.';
    const source = { ...entry, kind: 'event', name, description, facts: [{ glyph: 'calendar', value: 'Tomorrow' }] };
    const tree = mount(<DaybreakFeature entry={source} catalog={empty} now={new Date(2026, 10, 3, 12)} />);
    const snapshot = nodes(tree).find(node => node.props.testID === 'daybreak-poster-description');
    expect(snapshot.props.numberOfLines).toBe(1);
    expect(snapshot.children.join('')).toBe(compactCardText(description));
    expect(snapshot.children.join('').length).toBeLessThanOrEqual(80);
    expect(nodes(tree).some(node => node.type === 'Text' && node.children?.includes(shortCardTitle(name)))).toBe(true);
    expect(pressable(tree, 'daybreak-poster').props.accessibilityLabel).toContain(name);
  });
  it('keeps the By day / After hours pill toggle connected to its featured pool', () => {
    const changed = jest.fn(), tree = mount(<DaybreakPeriodPicker value="day" onChange={changed} />);
    expect(pressable(tree, 'daybreak-period-day').props.accessibilityState.selected).toBe(true);
    act(() => pressable(tree, 'daybreak-period-evening').props.onPress());
    expect(changed).toHaveBeenLastCalledWith('evening');
    act(() => tree.update(<DaybreakPeriodPicker value="evening" onChange={changed} />));
    expect(pressable(tree, 'daybreak-period-evening').props.accessibilityState.selected).toBe(true);
    expect(pressable(tree, 'daybreak-period-evening').props['aria-selected']).toBe(true);
    expect(pressable(tree, 'daybreak-period-day').props.accessibilityState.selected).toBe(false);
  });
  it('retains round action sizing', () => {
    const tree = mount(<PerksRoundButton testID="round" label="Offers" glyph="tag" onPress={() => {}} />);
    expect(style(tree, 'round')).toMatchObject({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' });
  });
  it('keeps Discover and Offers promotions as thin soft-gradient ribbons', () => {
    for (const compact of [false, true]) {
      const tree = mount(<LocalPerksBanners catalog={empty} compact={compact} />);
      expect(tree.root.findAllByProps({ testID: 'perks-banner-vee' })).toHaveLength(0);
      expect(style(tree, 'perks-banner-stay')).toMatchObject({ height: 44, flexDirection: 'row', borderRadius: 13 });
      expect(nodes(tree).filter(node => node.props.testID === 'aurora-soft-fill').length).toBeGreaterThan(0);
    }
  });
  it('keeps compact rows focused on the venue and opens its real detail route', () => {
    const tree = mount(<LocalPerksCard entry={entry} catalog={empty} />);
    expect(style(tree, 'perks-place-open')).toMatchObject({ flexDirection: 'row', minHeight: 86, padding: 8 });
    expect(tree.root.findAllByProps({ testID: 'perks-save-place' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'perks-add-stop' })).toHaveLength(0);
    act(() => tree.root.findByProps({ testID: 'perks-place-open' }).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=source-cafe');
  });
  it('shows the Home poster and rows with source-backed facts and their real destinations', () => {
    const source = { ...freshEntry, description: 'A source-backed snapshot.', facts: [{ glyph: 'pin', value: '0.4 mi' }] };
    const poster = mount(<DaybreakFeature entry={source} catalog={empty} now={new Date(2026, 10, 3, 12)} />);
    expect(style(poster, 'daybreak-poster-frame')).toMatchObject({ borderRadius: 24, overflow: 'hidden' });
    expect(style(poster, 'daybreak-poster-photo')).toMatchObject({ height: 136, overflow: 'hidden' });
    expect(nodes(poster).filter(node => node.props.testID === 'aurora-poster-add')).toHaveLength(1);
    const facts = poster.root.findByProps({ testID: 'aurora-poster-facts' });
    expect(nodes(poster).filter(node => node.props.accessible && ['0.4 mi', 'Menu'].some(label => (node.props.accessibilityLabel || '').includes(label)))).not.toHaveLength(0);
    expect(facts.props.children).toHaveLength(2);
    act(() => pressable(poster, 'daybreak-poster').props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=source-cafe');
    const row = mount(<AuroraEntryRow testID="daybreak-home-row" entry={source} catalog={empty} now={new Date(2026, 10, 3, 12)} />);
    expect(style(row, 'daybreak-home-row')).toMatchObject({ flexDirection: 'row', minHeight: 64 });
    expect(nodes(row).some(node => node.type === 'Text' && (node.children || []).join('').endsWith('· 0.4 mi'))).toBe(true);
    act(() => pressable(row, 'daybreak-home-row').props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=source-cafe');
  });
  it('uses regular inline metadata pills and keeps rail actions off the facts', () => {
    const source = { ...freshEntry, facts: [{ glyph: 'pin', value: '<0.1 mi' }], detailContent: offerCatalog.entries['place:source-cafe'].detailContent };
    const tree = mount(<LocalPerksCard entry={source} catalog={empty} format="rail" width={280} />);
    expect(nodes(tree).filter(node => node.props.testID === 'card-photo-label')).toHaveLength(0);
    const pills = nodes(tree).filter(node => /^card-metadata-(pin:0|menu|offer)$/.test(node.props.testID || ''));
    expect(pills).toHaveLength(3);
    for (const pill of pills) expect(StyleSheet.flatten(pill.props.style)).toMatchObject({ minHeight: 30, flexDirection: 'row', borderRadius: 999, borderWidth: 0 });
    expect(style(tree, 'card-metadata-pin:0').backgroundColor).toBe(ROLES['accent-tint'][theme]);
    expect(style(tree, 'card-metadata-menu').backgroundColor).toBe(ROLES['accent-tint'][theme]);
    expect(style(tree, 'card-metadata-offer').backgroundColor).toBe(ROLES['accent-tint'][theme]);
    expect(style(tree, 'perks-add-stop')).toMatchObject({ top: 92, right: 18 });
    expect(style(tree, 'perks-add-stop').bottom).toBeUndefined();
  });
  it('keeps four equally sized navigation tabs', () => {
    const items = ['index', 'discover', 'create', 'profile'].map(key => ({ key, label: key, glyph: 'home', selected: key === 'index', onPress: () => {} }));
    const tree = mount(<EditorialNav items={items} />), tabs = nodes(tree).filter(node => node.props.accessibilityRole === 'tab');
    expect(tabs).toHaveLength(4);
    tabs.forEach(tab => expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ flex: 1, minHeight: 50, alignItems: 'center', borderRadius: 10 }));
    expect(StyleSheet.flatten(tabs.find(tab => tab.props.accessibilityState.selected).props.style).backgroundColor).toBe(ROLES['accent-tint'][theme]);
    expect(tabs.filter(tab => tab.props.accessibilityState.selected)).toHaveLength(1);
  });
  it('keeps the category row touch targets and each separate category destination', () => {
    const tree = mount(<LocalCategoryShelf catalog={empty} />);
    for (const category of ['eat', 'bars', 'routes', 'events']) {
      expect(style(tree, `home-category-${category}`)).toMatchObject({ flex: 1, minWidth: 0, minHeight: 64, alignItems: 'center' });
      act(() => tree.root.findByProps({ testID: `home-category-${category}` }).props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith('/home/' + category);
    }
    const browse = mount(<LocalCategoryShelf catalog={empty} tone="browse" active="bars" onSelect={() => {}} />);
    expect(nodes(browse).filter(node => /^category-selected-/.test(node.props.testID || '')).map(node => node.props.testID)).toEqual(['category-selected-bars']);
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
    const picks = nodes(tree).filter(node => /^home-recommendation-(?!pulse)/.test(node.props.testID || ''));
    const bolts = nodes(tree).filter(node => node.props.testID === 'home-recommendation-pulse');
    expect(bolts).toHaveLength(picks.length);
    expect(bolts.length).toBeGreaterThan(0);
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
