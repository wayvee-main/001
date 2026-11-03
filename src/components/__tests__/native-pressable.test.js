import { expect, it } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Pressable, StyleSheet, Text } from 'react-native';
import { createInteropElement, cssInterop } from 'react-native-css-interop';
import { NativePressable } from '@/components/native-pressable';

// Production NativeWind registers core components automatically. Its test
// runtime deliberately doesn't, so register the real native wrapper here.
cssInterop(Pressable, { className: 'style' });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it('retains callback-supplied layout through the native styling runtime', () => {
  const style = { width: 36, height: 36, flexDirection: 'row', borderRadius: 18, position: 'absolute', right: 11 };
  let tree;
  act(() => {
    tree = renderer.create(createInteropElement(NativePressable, {
      testID: 'native-style-probe',
      style: () => style,
      children: React.createElement(Text, null, 'Save'),
    }));
  });
  const actual = StyleSheet.flatten(tree.toJSON().props.style);
  expect(actual).toMatchObject(style);
  act(() => tree.unmount());
});
