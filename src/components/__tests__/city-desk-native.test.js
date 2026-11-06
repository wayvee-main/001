import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cssInterop } from 'react-native-css-interop';
import { CityDeskFamilyTabs, CityDeskFeature, CityDeskTicket } from '@/components/city-desk';
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
jest.mock('@/lib/home-index-photos', () => ({ homeIndexPhotos: () => [] }));
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
