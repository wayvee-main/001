import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { useAurora } from '@/lib/aurora';
import { useThemeColors } from '@/lib/theme';

/* Onboarding's line art, drawn in the language of the Bay map: dotted gradient
 * lines, haloed dots and plain labels — nothing glossy, no italic inside the
 * art. Every name and number here is real catalog data (Bonobo at the Fox,
 * Eli's Blue Mondays, Bocanova's $2 oysters, Calavera, Night Heron). All of it
 * is decorative: the screen's headline says what the picture means. */

const W = 390, H = 300;

type Ink = { line: string; dot: string; strong: string; muted: string; faint: string };

function useArtInk(id: string): Ink {
  const colors = useThemeColors();
  return { line: `url(#${id}-u)`, dot: `url(#${id}-b)`, strong: colors.fg, muted: colors['fg-muted'], faint: colors['fg-muted'] };
}

/** The frame every illustration draws into: two versions of the Aurora text
 * gradient — across the whole picture for lines, and per shape for dots. */
function ArtFrame({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const aurora = useAurora();
  const [a, b, c] = aurora.text;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} accessible={false} accessibilityLabel={label}>
      <Defs>
        <LinearGradient id={`${id}-u`} gradientUnits="userSpaceOnUse" x1="0" y1={H} x2={W} y2="0">
          <Stop offset="0" stopColor={a} /><Stop offset="0.5" stopColor={b} /><Stop offset="1" stopColor={c} />
        </LinearGradient>
        <LinearGradient id={`${id}-b`} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={a} /><Stop offset="0.5" stopColor={b} /><Stop offset="1" stopColor={c} />
        </LinearGradient>
      </Defs>
      {children}
    </Svg>
  );
}

const DOTTED = { strokeWidth: 1.5, strokeDasharray: '3 5', strokeLinecap: 'round' as const, fill: 'none' };

function Node({ x, y, big = false, ink }: { x: number; y: number; big?: boolean; ink: Ink }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={big ? 6.5 : 3.8} fill={ink.dot} />
      {big ? <Circle cx={x} cy={y} r={13} fill="none" stroke={ink.dot} strokeWidth={1.2} opacity={0.45} /> : null}
    </G>
  );
}

/** One label: 'big' is the bold name, the default is its quiet second line. */
function Label({ x, y, text, ink, big = false, anchor = 'start', size }: { x: number; y: number; text: string; ink: Ink; big?: boolean; anchor?: 'start' | 'middle' | 'end'; size?: number }) {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fill={big ? ink.strong : ink.muted} fontSize={size ?? (big ? 15 : 12.5)}
      fontFamily={big ? 'Outfit_700Bold' : 'Outfit_500Medium'}>{text}</SvgText>
  );
}

/** Small caps under a point (weekdays, "OYSTERS"). */
function Caps({ x, y, text, ink }: { x: number; y: number; text: string; ink: Ink }) {
  return <SvgText x={x} y={y} textAnchor="middle" fill={ink.faint} fontSize={10.5} letterSpacing={1.4} fontFamily="Outfit_700Bold">{text}</SvgText>;
}

const artId = (raw: string) => 'oa' + raw.replace(/[^a-zA-Z0-9]/g, '');

// ── 1 · The whole Bay ───────────────────────────────────────────────────────

const BAY: { name: string; lat: number; lon: number; big: boolean; right: boolean }[] = [
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194, big: true, right: false },
  { name: 'Oakland', lat: 37.8032, lon: -122.2716, big: true, right: true },
  { name: 'Berkeley', lat: 37.8715, lon: -122.273, big: false, right: false },
  { name: 'San Jose', lat: 37.3382, lon: -121.8863, big: false, right: true },
  { name: 'Palo Alto', lat: 37.4419, lon: -122.143, big: false, right: false },
  { name: 'San Mateo', lat: 37.563, lon: -122.3255, big: false, right: false },
  { name: 'Walnut Creek', lat: 37.9101, lon: -122.0652, big: false, right: true },
  { name: 'Napa', lat: 38.2975, lon: -122.2869, big: false, right: true },
];
const BAY_KY = 268 / 1.02, BAY_KX = BAY_KY * 0.79;
const bayPoint = (lat: number, lon: number) => ({ x: 195 + (lon + 122.16) * BAY_KX, y: 18 + (38.33 - lat) * BAY_KY });
const BAY_POINTS = Object.fromEntries(BAY.map(city => [city.name, bayPoint(city.lat, city.lon)]));
const BAY_LINKS = [['San Francisco', 'Oakland'], ['Oakland', 'Berkeley'], ['Berkeley', 'Napa'], ['Oakland', 'Walnut Creek'], ['San Francisco', 'San Mateo'], ['San Mateo', 'Palo Alto'], ['Palo Alto', 'San Jose']];

/** Eight Bay cities at their real relative positions, joined by dotted roads. */
export function BayConstellation() {
  const id = artId(useId()), ink = useArtInk(id);
  return (
    <ArtFrame id={id} label="The Bay Area: San Francisco, Oakland and six more cities">
      {BAY_LINKS.map(([from, to]) => {
        const a = BAY_POINTS[from], b = BAY_POINTS[to];
        return <Path key={from + to} d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} stroke={ink.line} {...DOTTED} strokeWidth={1.4} opacity={0.55} />;
      })}
      {BAY.map(city => {
        const { x, y } = BAY_POINTS[city.name];
        return (
          <G key={city.name}>
            <Circle cx={x} cy={y} r={city.big ? 7 : 4.5} fill={ink.dot} />
            {city.big ? <Circle cx={x} cy={y} r={14} fill="none" stroke={ink.dot} strokeWidth={1.2} opacity={0.45} /> : null}
            <Label x={x + (city.right ? 13 : -13)} y={y + 4.5} text={city.name} ink={ink} big={city.big} anchor={city.right ? 'start' : 'end'} size={city.big ? 16 : 13} />
          </G>
        );
      })}
    </ArtFrame>
  );
}

// ── 2 · Every date, checked ─────────────────────────────────────────────────

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEK = DAYS.map((_, i) => ({ x: 42 + i * 51, y: 182 + Math.sin(i * 0.95 + 0.4) * 20 }));
const WEEK_PATH = WEEK.slice(1).reduce((path, point, i) => {
  const prev = WEEK[i];
  return `${path} C ${prev.x + 24} ${prev.y.toFixed(1)}, ${point.x - 24} ${point.y.toFixed(1)}, ${point.x} ${point.y.toFixed(1)}`;
}, `M${WEEK[0].x} ${WEEK[0].y.toFixed(1)}`);

/** A week as one line, with its two real dates lit: Eli's weekly Blue Mondays
 * and Bonobo at the Fox on Saturday, November 14. */
export function WeekLine() {
  const id = artId(useId()), ink = useArtInk(id);
  const mon = WEEK[0], sat = WEEK[5];
  return (
    <ArtFrame id={id} label="A week with two dates: Blue Mondays at Eli's, and Bonobo at the Fox Theater on Saturday, November 14">
      <Path d={WEEK_PATH} stroke={ink.line} {...DOTTED} opacity={0.6} />
      {WEEK.map((point, i) => (
        <G key={DAYS[i]}>
          <Node x={point.x} y={point.y} big={i === 0 || i === 5} ink={ink} />
          <Caps x={point.x} y={point.y + 30} text={DAYS[i]} ink={ink} />
        </G>
      ))}
      <Path d={`M${mon.x} ${(mon.y - 14).toFixed(1)} V${(mon.y - 52).toFixed(1)}`} stroke={ink.line} strokeWidth={1.2} strokeDasharray="2 4" strokeLinecap="round" opacity={0.5} />
      <Label x={mon.x - 8} y={mon.y - 76} text="Blue Mondays" ink={ink} big />
      <Label x={mon.x - 8} y={mon.y - 58} text="every week · Eli’s" ink={ink} />
      <Path d={`M${sat.x} ${(sat.y - 14).toFixed(1)} V${(sat.y - 64).toFixed(1)}`} stroke={ink.line} strokeWidth={1.2} strokeDasharray="2 4" strokeLinecap="round" opacity={0.5} />
      <Label x={sat.x + 8} y={sat.y - 88} text="Bonobo" ink={ink} big anchor="end" />
      <Label x={sat.x + 8} y={sat.y - 70} text="Fox Theater · Sat, Nov 14" ink={ink} anchor="end" />
    </ArtFrame>
  );
}

// ── 3 · Deals that are actually on ──────────────────────────────────────────

/** Bocanova's happy hour as an arc on a quiet clock: $2 oysters, 3–6 PM, daily. */
export function HappyHourClock() {
  const id = artId(useId()), ink = useArtInk(id);
  const cx = 195, cy = 150, r = 96;
  return (
    <ArtFrame id={id} label="Bocanova: $2 oysters daily, 3 to 6 PM">
      <Circle cx={cx} cy={cy} r={r} stroke={ink.line} {...DOTTED} opacity={0.6} />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return <Circle key={i} cx={cx + Math.cos(angle) * r} cy={cy + Math.sin(angle) * r} r={1.8} fill={ink.faint} opacity={0.45} />;
      })}
      <Path d={`M${cx + r} ${cy} A${r} ${r} 0 0 1 ${cx} ${cy + r}`} stroke={ink.line} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Node x={cx + r} y={cy} big ink={ink} />
      <Node x={cx} y={cy + r} big ink={ink} />
      <Label x={cx + r + 20} y={cy + 5} text="3 PM" ink={ink} big />
      <Label x={cx} y={cy + r + 34} text="6 PM" ink={ink} big anchor="middle" />
      <SvgText x={cx} y={cy + 8} textAnchor="middle" fill={ink.line} fontSize={46} letterSpacing={-1.5} fontFamily="Outfit_700Bold">$2</SvgText>
      <Caps x={cx} y={cy + 30} text="OYSTERS" ink={ink} />
      <Label x={cx - r - 18} y={cy - 54} text="Bocanova" ink={ink} anchor="end" />
      <Label x={cx - r - 18} y={cy - 37} text="Daily" ink={ink} anchor="end" />
      <Path d={`M${cx - r - 12} ${cy - 46} C ${cx - r + 10} ${cy - 46}, ${cx - 60} ${cy - 40}, ${cx - 38} ${cy - 20}`} stroke={ink.line} {...DOTTED} strokeWidth={1.2} opacity={0.45} />
    </ArtFrame>
  );
}

// ── 4 · Then, let Vee ───────────────────────────────────────────────────────

/** The Vee spiral, as drawn by VeeMark, in a 40-unit box. */
const SPIRAL = 'M25.4 16.4 A0.9 0.9 0 0 1 23.6 16.4 A1.8 1.8 0 0 1 27.2 16.4 A3.6 3.6 0 0 1 20 16.4 A7.2 7.2 0 0 1 34.4 16.4 A14.4 14.4 0 0 1 5.6 16.4';

/** One night as a route out of the Vee spiral: dinner, the show, a nightcap. */
export function NightRoute() {
  const id = artId(useId()), ink = useArtInk(id);
  return (
    <ArtFrame id={id} label="One night: dinner at Calavera, the show at the Fox Theater, a nightcap at Night Heron">
      <G transform="translate(26 54) scale(1.05)">
        <Path d={SPIRAL} stroke={ink.line} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </G>
      <Path d="M50 96 C 70 116, 76 132, 92 140 C 132 158, 156 214, 200 196 C 244 178, 262 112, 312 122 C 334 126, 348 140, 356 156" stroke={ink.line} {...DOTTED} opacity={0.6} />
      <Node x={92} y={140} big ink={ink} />
      <Node x={200} y={196} big ink={ink} />
      <Node x={312} y={122} big ink={ink} />
      <Label x={92} y={182} text="Dinner" ink={ink} big anchor="middle" />
      <Label x={92} y={200} text="Calavera" ink={ink} anchor="middle" />
      <Label x={200} y={236} text="The show" ink={ink} big anchor="middle" />
      <Label x={200} y={254} text="Fox Theater" ink={ink} anchor="middle" />
      <Label x={312} y={84} text="Nightcap" ink={ink} big anchor="middle" />
      <Label x={312} y={102} text="Night Heron" ink={ink} anchor="middle" />
    </ArtFrame>
  );
}

// ── Location · you, and what's near ─────────────────────────────────────────

const SPOKES: { x: number; y: number; name: string; minutes: string; anchor: 'start' | 'end'; dx: number }[] = [
  { x: 300, y: 76, name: 'Coffee', minutes: '4 min', anchor: 'start', dx: 12 },
  { x: 70, y: 132, name: 'Dinner', minutes: '9 min', anchor: 'end', dx: -12 },
  { x: 296, y: 238, name: 'Live music', minutes: '14 min', anchor: 'start', dx: 12 },
  { x: 120, y: 250, name: 'A walk', minutes: '7 min', anchor: 'end', dx: -12 },
];

/** You at the centre, with nearby things measured in minutes. */
export function NearbyRings() {
  const id = artId(useId()), ink = useArtInk(id);
  const cx = 195, cy = 150;
  return (
    <ArtFrame id={id} label="You at the centre, with coffee, dinner, a walk and live music a few minutes away">
      <Circle cx={cx} cy={cy} r={104} stroke={ink.line} {...DOTTED} opacity={0.28} />
      <Circle cx={cx} cy={cy} r={54} stroke={ink.line} {...DOTTED} opacity={0.6} />
      {SPOKES.map(spoke => (
        <Path key={spoke.name} d={`M${cx} ${cy} Q ${(cx + spoke.x) / 2 + (spoke.y < cy ? 18 : -18)} ${(cy + spoke.y) / 2}, ${spoke.x} ${spoke.y}`} stroke={ink.line} {...DOTTED} opacity={0.6} />
      ))}
      {SPOKES.map(spoke => (
        <G key={spoke.name + 'n'}>
          <Node x={spoke.x} y={spoke.y} ink={ink} />
          <Label x={spoke.x + spoke.dx} y={spoke.y - 2} text={spoke.name} ink={ink} big anchor={spoke.anchor} />
          <Label x={spoke.x + spoke.dx} y={spoke.y + 15} text={spoke.minutes} ink={ink} anchor={spoke.anchor} />
        </G>
      ))}
      <Circle cx={cx} cy={cy} r={8} fill={ink.dot} />
      <Circle cx={cx} cy={cy} r={18} fill="none" stroke={ink.dot} strokeWidth={1.2} opacity={0.45} />
      <Circle cx={cx} cy={cy} r={30} fill="none" stroke={ink.dot} strokeWidth={1.2} opacity={0.2} />
    </ArtFrame>
  );
}

// ── Soft lights ─────────────────────────────────────────────────────────────

/** Where each light sits in a 390×420 hero: peach left, lilac right, rose low. */
const ORB_SPOTS = [
  { cx: 140, cy: 190, r: 110 },
  { cx: 260, cy: 160, r: 120 },
  { cx: 220, cy: 300, r: 80 },
] as const;

/** Blurred lights behind an illustration — radial gradients, so they ship
 * over the air with no blur module. `lights` picks which of the three show. */
export function StoryOrbs({ lights = [0, 1, 2] }: { lights?: (0 | 1 | 2)[] }) {
  const aurora = useAurora(), id = artId(useId());
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 420" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {lights.map(index => {
            const spot = ORB_SPOTS[index], orb = aurora.orbs[index], reach = spot.r + 70;
            return (
              <RadialGradient key={index} id={`${id}-${index}`} gradientUnits="userSpaceOnUse" cx={spot.cx} cy={spot.cy} r={reach} fx={spot.cx} fy={spot.cy}>
                <Stop offset="0" stopColor={orb.color} stopOpacity={orb.opacity} />
                <Stop offset={String((spot.r - 40) / reach)} stopColor={orb.color} stopOpacity={orb.opacity * 0.9} />
                <Stop offset={String((spot.r + 20) / reach)} stopColor={orb.color} stopOpacity={orb.opacity * 0.4} />
                <Stop offset="1" stopColor={orb.color} stopOpacity={0} />
              </RadialGradient>
            );
          })}
        </Defs>
        {lights.map(index => {
          const spot = ORB_SPOTS[index];
          return <Circle key={index} cx={spot.cx} cy={spot.cy} r={spot.r + 70} fill={`url(#${id}-${index})`} />;
        })}
      </Svg>
    </View>
  );
}
