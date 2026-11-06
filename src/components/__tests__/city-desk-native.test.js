import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cssInterop } from 'react-native-css-interop';
import { CityDeskCalmPair, CityDeskFamilyTabs, CityDeskFeature, CityDeskTicket, CityDeskWeather, cityDeskHomeHeadline } from '@/components/city-desk';
import { CitySearchBar } from '@/components/city-controls';
import { Photo } from '@/components/photo';
import { StubTicket } from '@/components/stub-cards';

const mockPush = jest.fn(), mockSave = jest.fn(), mockAdd = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/theme', () => {
  const { ROLES } = require('@/lib/tokens');
  return { useThemeColors: () => Object.fromEntries(Object.entries(ROLES).map(([key, value]) => [key, value.light])) };
});
jest.mock('@/components/glyph', () => ({ Glyph: () => null }));
jest.mock('@/components/photo', () => ({ Photo: () => null }));
jest.mock('@/lib/weather', () => ({ useWeatherNow: () => null, weatherLine: () => '' }));
jest.mock('@/lib/home-index-photos', () => ({ homeIndexPhotos: entry => [{ source: `https://venue.example/${entry.id}.jpg` }] }));
jest.mock('@/lib/use-entry-actions', () => ({ useEntryActions: () => ({ saved: false, canSave: true, save: mockSave, added: false, add: mockAdd }) }));
for (const component of [Pressable, Text, View]) cssInterop(component, { className: 'style' });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let trees = [];
const catalog = { entries: {}, categories: { eat: [], bars: [], routes: [], events: [] }, collections: [] };
const entry = { kind: 'place', id: 'local-table', name: 'A Local Table', caption: 'Neighborhood restaurant', description: 'A source-backed description.', glyph: 'food', facts: [], details: [], links: [], searchText: '', saveKind: 'place' };
const mount = element => { let tree; act(() => { tree = renderer.create(element); }); trees.push(tree); return tree; };
const control = (tree, id) => tree.root.findAll(node => node.props.testID === id && typeof node.props.onPress === 'function')[0];
afterEach(() => { act(() => trees.forEach(tree => tree.unmount())); trees = []; jest.clearAllMocks(); });

describe('City Desk on Android', () => {
  it('uses a short, different single-line greeting for each part of the day', () => {
    const hours = [8, 12, 15, 19, 23];
    const headlines = hours.map(hour => cityDeskHomeHeadline(new Date(2026, 10, 6, hour)).join(''));
    expect(new Set(headlines).size).toBe(5);
    expect(headlines.every(headline => headline.length < 27 && !headline.includes('\n'))).toBe(true);
  });

  it('keeps the City Desk search label local without a redundant day or area line', () => {
    const tree = mount(<CitySearchBar variant="citydesk" testID="home-search" city="Oakland" onPress={jest.fn()} />);
    expect(tree.root.findAllByProps({ testID: 'home-search-area' })).toHaveLength(0);
    expect(tree.root.findAll(node => node.props.accessibilityLabel?.includes('Search Oakland'))).not.toHaveLength(0);
  });

  it('shows an honest weather status beneath the home logo while the forecast is unavailable', () => {
    const tree = mount(<CityDeskWeather city="Oakland" />);
    expect(tree.root.findByProps({ testID: 'home-weather' }).props.accessibilityLabel).toBe('Oakland weather. Weather unavailable');
  });

  it('keeps chapter tabs operable and exposes the selected family through native interop', () => {
    const onSelect = jest.fn();
    const families = [{ id: 'eat', title: 'Eat' }, { id: 'go-out', title: 'Go out' }];
    const tree = mount(<CityDeskFamilyTabs families={families} selected="eat" onSelect={onSelect} />);
    const eat = control(tree, 'citydesk-family-eat'), go = control(tree, 'citydesk-family-go-out');
    expect(eat.props.accessibilityState.selected).toBe(true);
    expect(go.props.accessibilityState.selected).toBe(false);
    // This used to disappear when a style callback was passed through NativeWind.
    const native = tree.root.findAll(node => node.type === 'View' && node.props.testID === 'citydesk-family-go-out')[0];
    expect(StyleSheet.flatten(native.props.style).minHeight).toBeGreaterThanOrEqual(44);
    act(() => go.props.onPress());
    expect(onSelect).toHaveBeenCalledWith('go-out');
  });

  it('opens the actual listing and never invents a date for an undated ticket', () => {
    const undated = { ...entry, kind: 'event', id: 'undated-event', saveKind: undefined };
    const tree = mount(<CityDeskTicket entry={undated} catalog={catalog} now={new Date('2026-11-06T12:00:00Z')} testID="ticket" />);
    expect(tree.root.findByType(StubTicket).props.lead.kind).toBe('thumb');
    act(() => control(tree, 'ticket').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/home/detail?kind=event&id=undated-event');
  });

  it('opens both real Calm pair destinations and keeps each photo tied to its own venue', () => {
    const event = { ...entry, kind: 'event', id: 'local-show', name: 'A Long Local Show Title With Extra Words', caption: 'Fox Theater', facts: [{ glyph: 'calendar', value: 'Nov 14' }, { glyph: 'clock', value: '8 PM' }] };
    const tree = mount(<CityDeskCalmPair entries={[entry, event]} catalog={catalog} now={new Date('2026-11-06T12:00:00Z')} />);
    const rows = tree.root.findAll(node => node.props.testID === 'daybreak-home-row' && typeof node.props.onPress === 'function');
    act(() => rows.find(node => node.props.accessibilityLabel.startsWith(entry.name)).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=place&id=local-table');
    act(() => rows.find(node => node.props.accessibilityLabel.startsWith(event.name)).props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith('/home/detail?kind=event&id=local-show');
    const photos = tree.root.findAllByType(Photo);
    expect(photos.map(photo => photo.props.candidates[0].source)).toEqual(['https://venue.example/local-table.jpg', 'https://venue.example/local-show.jpg']);
    expect(photos.every(photo => photo.props.retryable === false)).toBe(true);
    expect(tree.root.findAllByType(StubTicket)).toHaveLength(0);
  });

  it('keeps a single available Calm pair pick usable without an empty second slot', () => {
    const tree = mount(<CityDeskCalmPair entries={[entry]} catalog={catalog} now={new Date('2026-11-06T12:00:00Z')} />);
    expect(tree.root.findAllByType(Photo)).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'calm-pair-divider' })).toHaveLength(0);
    act(() => control(tree, 'daybreak-home-row').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/home/detail?kind=place&id=local-table');
  });

  it('retains the feature’s separate detail, save and evening actions', () => {
    const tree = mount(<CityDeskFeature entry={entry} catalog={catalog} now={new Date('2026-11-06T12:00:00Z')} />);
    act(() => control(tree, 'citydesk-feature-open').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/home/detail?kind=place&id=local-table');
    act(() => control(tree, 'citydesk-feature-save').props.onPress());
    expect(mockSave).toHaveBeenCalledTimes(1);
    act(() => control(tree, 'citydesk-feature-add').props.onPress());
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });
});
