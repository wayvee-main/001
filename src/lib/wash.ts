import { useColorScheme } from 'nativewind';

/**
 * The arrival sequence's own warmer ink and translucent-control ramp. Its
 * background now shares the app's paper/plum ground; these roles remain local
 * because first-run helper copy and selection states still need a warmer voice
 * than ordinary content screens.
 *
 * Everything here is a surface or a lettering colour *for that wash only*. If a
 * value in here starts being used on an ordinary screen, it belongs in
 * tokens.ts instead.
 */
interface WashRamp {
  helper: string;
  title: string;
  copy: string;
  body: string;
  strong: string;
  muted: string;
  cardBg: string;
  cardBorder: string;
  cardDivider: string;
  chipBg: string;
  chipBorder: string;
  chipSelectedBg: string;
  chipSelectedBorder: string;
  optionBg: string;
  optionSelectedBg: string;
  optionSelectedBorder: string;
  stateSelectedBg: string;
  stateSelectedBorder: string;
  stateIdle: string;
  walkSelectedBg: string;
  walkSelectedBorder: string;
  walkSelectedText: string;
  diet: string;
  rail: string;
  step: string;
  chrome: string;
  note: string;
  secondaryBg: string;
  secondaryText: string;
  fieldActiveBg: string;
  fieldActiveBorder: string;
  placeholder: string;
  hint: string;
  signupBg: string;
  signupText: string;
  /** null in light, where each interest tile carries its own category tint;
   * one shared tint in dark, where six tints would read as noise. */
  interestSelectedBg: string | null;
}

const WASH: Record<'light' | 'dark', WashRamp> = {
  light: {
    helper: '#9D4C30',
    title: '#7D2D10',
    copy: '#B06950',
    body: '#7D4938',
    strong: '#65250D',
    muted: '#8F5E4C',
    cardBg: 'rgba(255,253,250,0.74)',
    cardBorder: 'rgba(139,55,27,0.14)',
    cardDivider: 'rgba(139,55,27,0.12)',
    chipBg: 'rgba(255,253,250,0.67)',
    chipBorder: 'rgba(139,55,27,0.18)',
    chipSelectedBg: '#FFF0C8',
    chipSelectedBorder: 'rgba(232,93,44,0.38)',
    optionBg: 'rgba(255,253,250,0.72)',
    optionSelectedBg: 'rgba(255,199,87,0.24)',
    optionSelectedBorder: 'rgba(232,93,44,0.46)',
    stateSelectedBg: '#FFFDFA',
    stateSelectedBorder: 'rgba(232,93,44,0.22)',
    stateIdle: '#A28C81',
    walkSelectedBg: '#E8E3F8',
    walkSelectedBorder: 'rgba(111,91,209,0.52)',
    walkSelectedText: '#49398F',
    diet: '#5A47B0',
    rail: '#DDBEAE',
    step: '#A34B2D',
    chrome: '#8B371B',
    note: '#9B6551',
    secondaryBg: '#FFFDFA',
    secondaryText: '#171214',
    fieldActiveBg: '#FFFDFA',
    fieldActiveBorder: 'rgba(111,91,209,0.50)',
    placeholder: '#A57868',
    hint: '#A66A53',
    signupBg: '#FBE4DA',
    signupText: '#A23F1D',
    interestSelectedBg: null,
  },
  dark: {
    helper: '#F2A087',
    title: '#FFF4EF',
    copy: '#D1A99B',
    body: '#E5C7BC',
    strong: '#FFF4EF',
    muted: '#CEAA9D',
    cardBg: 'rgba(39,31,42,0.88)',
    cardBorder: 'rgba(255,170,141,0.16)',
    cardDivider: 'rgba(255,170,141,0.13)',
    chipBg: 'rgba(39,31,42,0.90)',
    chipBorder: 'rgba(255,170,141,0.20)',
    chipSelectedBg: '#403321',
    chipSelectedBorder: 'rgba(255,199,87,0.52)',
    optionBg: 'rgba(39,31,42,0.90)',
    optionSelectedBg: '#392925',
    optionSelectedBorder: 'rgba(232,93,44,0.66)',
    stateSelectedBg: '#1B161E',
    stateSelectedBorder: 'rgba(232,93,44,0.42)',
    stateIdle: '#B8AAB5',
    walkSelectedBg: '#332C4B',
    walkSelectedBorder: 'rgba(139,120,228,0.72)',
    walkSelectedText: '#D9D1FF',
    diet: '#B8A9FF',
    rail: '#624D58',
    step: '#FF9D7B',
    chrome: '#FFAA8D',
    note: '#D09D8A',
    secondaryBg: '#2A222E',
    secondaryText: '#FFFDFA',
    fieldActiveBg: '#1B161E',
    fieldActiveBorder: 'rgba(139,120,228,0.72)',
    placeholder: '#9F8D98',
    hint: '#D09D8A',
    signupBg: '#4A2A25',
    signupText: '#FF9C7B',
    interestSelectedBg: '#342B38',
  },
};

export type WashInk = WashRamp;

export function useWashInk(): WashInk {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'light' ? WASH.light : WASH.dark;
}
