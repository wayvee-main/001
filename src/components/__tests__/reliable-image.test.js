import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AppState, StyleSheet } from 'react-native';
import { ReliableImage, PHOTO_LOAD_TIMEOUT_MS } from '@/components/reliable-image';

jest.mock('expo-image', () => ({ Image: props => require('react').createElement('TestImage', props) }));
jest.mock('@/components/glyph', () => ({ Glyph: () => null }));
jest.mock('@/lib/theme', () => ({ useThemeColors: () => ({ 'surface-soft': '#EEE', 'fg-muted': '#555' }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let trees = [], appStateChanged;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => { appStateChanged = listener; return { remove: jest.fn() }; });
});
afterEach(() => { act(() => trees.forEach(tree => tree.unmount())); trees = []; jest.useRealTimers(); jest.restoreAllMocks(); });
const candidate = name => ({ source: `https://venue.example/${name}.jpg`, label: name });
function mount(candidates, onUnavailable = jest.fn()) {
  let tree; act(() => { tree = renderer.create(<ReliableImage candidates={candidates} label="Venue photo" onUnavailable={onUnavailable} />); });
  trees.push(tree); return tree;
}
const image = tree => tree.root.findByType('TestImage');

it('advances a failed source once and ignores duplicate late errors', () => {
  const tree = mount([candidate('cover'), candidate('gallery'), candidate('dish')]);
  const oldError = image(tree).props.onError;
  act(() => oldError());
  expect(image(tree).props.source).toEqual({ uri: candidate('gallery').source });
  act(() => oldError());
  expect(image(tree).props.source).toEqual({ uri: candidate('gallery').source });
});

it('displays cached photos without an opacity gate or a later timeout', () => {
  const unavailable = jest.fn(), tree = mount([candidate('cover'), candidate('backup')], unavailable);
  expect(StyleSheet.flatten(image(tree).props.style).opacity).toBeUndefined();
  act(() => image(tree).props.onDisplay());
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS * 3));
  expect(image(tree).props.source).toEqual({ uri: candidate('cover').source });
  expect(unavailable).not.toHaveBeenCalled();
});

it('tries a remote fallback if a bundled asset fails', () => {
  const tree = mount([{ source: 12 }, candidate('official')]);
  act(() => image(tree).props.onError());
  expect(image(tree).props.source).toEqual({ uri: candidate('official').source });
});

it('advances a stalled request while ordinary re-renders do not reset its deadline', () => {
  const tree = mount([candidate('slow'), candidate('backup')]);
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS - 1));
  act(() => tree.update(<ReliableImage candidates={[candidate('slow'), candidate('backup')]} label="Venue photo" />));
  act(() => jest.advanceTimersByTime(1));
  expect(image(tree).props.source).toEqual({ uri: candidate('backup').source });
});

it('does not time out photos while the app is backgrounded', () => {
  const tree = mount([candidate('cover'), candidate('backup')]);
  act(() => appStateChanged('background'));
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS * 4));
  expect(image(tree).props.source).toEqual({ uri: candidate('cover').source });
  act(() => appStateChanged('active'));
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS));
  expect(image(tree).props.source).toEqual({ uri: candidate('backup').source });
});

it('keeps slow progressing downloads alive and ignores progress from an old attempt', () => {
  const tree = mount([candidate('slow'), candidate('backup'), candidate('third')]);
  const oldProgress = image(tree).props.onProgress;
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS - 1));
  act(() => oldProgress({ loaded: 10, total: 100 }));
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS - 1));
  act(() => oldProgress({ loaded: 20, total: 100 }));
  expect(image(tree).props.source).toEqual({ uri: candidate('slow').source });
  act(() => image(tree).props.onError());
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS - 1));
  act(() => oldProgress({ loaded: 30, total: 100 }));
  act(() => jest.advanceTimersByTime(1));
  expect(image(tree).props.source).toEqual({ uri: candidate('third').source });
});

it('isolates a new venue from the previous venue’s late callbacks', () => {
  const tree = mount([candidate('old')]), oldError = image(tree).props.onError, oldKey = image(tree).props.recyclingKey;
  act(() => tree.update(<ReliableImage candidates={[candidate('new'), candidate('new-backup')]} label="New venue" />));
  act(() => oldError());
  expect(image(tree).props.source).toEqual({ uri: candidate('new').source });
  expect(image(tree).props.recyclingKey).not.toBe(oldKey);
});

it('notifies exhaustion once and provides a fresh explicit retry', () => {
  const unavailable = jest.fn(), tree = mount([candidate('cover'), candidate('backup')], unavailable);
  const staleError = image(tree).props.onError;
  act(() => image(tree).props.onError());
  act(() => image(tree).props.onError());
  expect(unavailable).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('TestImage')).toHaveLength(0);
  act(() => tree.root.findByProps({ testID: 'reliable-image-retry' }).props.onPress());
  expect(image(tree).props.recyclingKey).toMatch(/:1:0$/);
  act(() => staleError());
  expect(image(tree).props.source).toEqual({ uri: candidate('cover').source });
  act(() => image(tree).props.onLoad());
  expect(unavailable).toHaveBeenCalledTimes(1);
});

it('deduplicates sources and bounds failures without an automatic retry loop', () => {
  const unavailable = jest.fn(), tree = mount([candidate('0'), ...Array.from({ length: 12 }, (_, index) => candidate(String(index)))], unavailable);
  for (let index = 0; index < 8; index++) act(() => image(tree).props.onError());
  expect(unavailable).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(PHOTO_LOAD_TIMEOUT_MS * 10));
  expect(tree.root.findAllByType('TestImage')).toHaveLength(0);
  expect(unavailable).toHaveBeenCalledTimes(1);
});
