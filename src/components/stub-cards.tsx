import type { ReactNode } from 'react';
import { ScrollView, Text, View, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { GradientFill, GradientText, useAuroraCard } from '@/components/aurora';
import { Glyph, type GlyphName } from '@/components/glyph';
import { useAppGutter } from '@/components/layout';
import { MetadataPill } from '@/components/metadata-pill';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { Photo } from '@/components/photo';
import type { PhotoCandidate } from '@/components/reliable-image';
import { useAurora } from '@/lib/aurora';
import type { StubLead } from '@/lib/stub-cards';
import { useThemeColors } from '@/lib/theme';

/* Stub cards — one family for every card that sits in a row.
 *   StubTicket: short and wide. A stub on the left (calendar tile, a value, or
 *   the place's photo), a perforation, then the words.
 *   StubPoster: square-ish. Photo, name, a perforated seam, then pills.
 * The perforation's notches are cut in the page ground (bg), so the card reads
 * as a ticket on any screen that sits on bg. */

export type StubPhoto = { candidates?: readonly PhotoCandidate[]; uri?: string; glyph: string; label: string };
export type StubPill = { text: string; glyph?: string };
export type StubTag = 'Today' | 'Partner';

const NOTCH = 14;

function Perforation({ vertical }: { vertical: boolean }) {
  const colors = useThemeColors(), aurora = useAurora();
  const notch = { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.bg } as const;
  return vertical
    ? <View accessible={false} style={{ width: 2, alignSelf: 'stretch' }}>
      <Svg width={2} height="100%" style={{ position: 'absolute', top: 0, bottom: 0 }}><Line x1={1} y1={0} x2={1} y2="100%" stroke={aurora.rule} strokeWidth={1.5} strokeDasharray="3 4" /></Svg>
      <View style={{ ...notch, left: 1 - NOTCH / 2, top: -NOTCH / 2 }} /><View style={{ ...notch, left: 1 - NOTCH / 2, bottom: -NOTCH / 2 }} />
    </View>
    : <View accessible={false} style={{ height: 2, marginHorizontal: 12 }}>
      <Svg width="100%" height={2}><Line x1={0} y1={1} x2="100%" y2={1} stroke={aurora.rule} strokeWidth={1.5} strokeDasharray="3 4" /></Svg>
      <View style={{ ...notch, top: 1 - NOTCH / 2, left: -12 - NOTCH / 2 }} /><View style={{ ...notch, top: 1 - NOTCH / 2, right: -12 - NOTCH / 2 }} />
    </View>;
}

function Under({ text }: { text?: string }) {
  const colors = useThemeColors();
  return text ? <Text numberOfLines={1} className="font-dm-bold" style={{ marginTop: 4, maxWidth: 62, fontSize: 8.5, lineHeight: 11, letterSpacing: .7, color: colors['fg-muted'] }}>{text.toUpperCase()}</Text> : null;
}

/** The calendar tile: a gradient month strip over the day. Dates only. */
function CalendarTile({ top, value }: { top: string; value: string }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <View style={{ width: 46, borderRadius: 11, overflow: 'hidden', backgroundColor: colors['surface-raised'], borderWidth: 1, borderColor: aurora.glassEdge, alignItems: 'center' }}>
    <View style={{ alignSelf: 'stretch', height: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <GradientFill radius={0} />
      <Text className="font-dm-bold" style={{ fontSize: 8.5, lineHeight: 11, letterSpacing: .7, color: aurora.onFill }}>{top.toUpperCase()}</Text>
    </View>
    <Text className="font-dm-bold text-ink" style={{ fontSize: 17, lineHeight: 26, letterSpacing: -.5 }}>{value}</Text>
  </View>;
}

function IconWell({ glyph, size }: { glyph: string; size: number }) {
  const colors = useThemeColors();
  return <View style={{ width: size, height: size, borderRadius: size * .24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <GradientFill radius={size * .24} soft />
    <View><Glyph name={glyph as GlyphName} size={Math.round(size * .38)} color={colors['fg-accent']} strokeWidth={1.7} /></View>
  </View>;
}

function PhotoOrIcon({ photo, width, height, radius }: { photo: StubPhoto; width: number | `${number}%`; height: number; radius: number }) {
  const aurora = useAurora(), colors = useThemeColors();
  if (!photo.uri && !photo.candidates?.length) return <View style={{ width, height, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <GradientFill radius={radius} soft /><View><Glyph name={photo.glyph as GlyphName} size={Math.min(34, Math.round(height * .36))} color={colors['fg-accent']} strokeWidth={1.5} /></View>
  </View>;
  return <Photo uri={photo.uri} candidates={photo.candidates} radius={radius} stripedPlaceholder={false} retryable={false} fallbackGlyph={photo.glyph as GlyphName} fallbackLabel={photo.label}
    style={{ width, height, backgroundColor: aurora.photoFallback }} />;
}

function Lead({ lead, photo }: { lead: StubLead; photo?: StubPhoto }) {
  const colors = useThemeColors();
  if (lead.kind === 'date') return <><CalendarTile top={lead.top} value={lead.value} /><Under text={lead.under} /></>;
  if (lead.kind === 'value') return <><Text className="font-dm-bold" style={{ fontSize: 24, lineHeight: 28, letterSpacing: -.8 }}><GradientText text={lead.value} /></Text><Under text={lead.under} /></>;
  if (lead.kind === 'glyph') return <><View><Glyph name={lead.glyph as GlyphName} size={22} color={colors['fg-accent']} strokeWidth={2} /></View><Under text={lead.under} /></>;
  return photo ? <PhotoOrIcon photo={photo} width={58} height={58} radius={14} /> : <IconWell glyph="spark" size={58} />;
}

function Tags({ tags }: { tags?: readonly StubTag[] }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <>{(tags || []).map(tag => <View key={tag} style={{ borderRadius: 6, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1, backgroundColor: tag === 'Partner' ? colors['surface-sunk'] : undefined }}>
    {tag === 'Today' ? <GradientFill radius={6} /> : null}
    <Text className="font-dm-bold" style={{ fontSize: 9.5, lineHeight: 13, letterSpacing: .8, color: tag === 'Today' ? aurora.onFill : colors['fg-muted'] }}>{tag.toUpperCase()}</Text>
  </View>)}</>;
}

function Pills({ pills }: { pills?: readonly StubPill[] }) {
  return pills?.length ? <View style={{ flexDirection: 'row', gap: 5, overflow: 'hidden' }}>{pills.slice(0, 2).map(pill => <MetadataPill key={pill.text} text={pill.text} glyph={pill.glyph} />)}</View> : null;
}

/** Short and wide: stub, perforation, words — and the photo on the right when the stub is a date or a value. */
export function StubTicket({ lead, title, tags, caption, accent, pills, photo, width = 292, onPress, accessibilityLabel, testID }: {
  lead: StubLead; title: string; tags?: readonly StubTag[]; caption?: string; accent?: string; pills?: readonly StubPill[]; photo?: StubPhoto;
  width?: number | 'full'; onPress: () => void; accessibilityLabel: string; testID?: string;
}) {
  const colors = useThemeColors(), card = useAuroraCard();
  const sidePhoto = lead.kind !== 'thumb' && photo && (photo.uri || photo.candidates?.length);
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
    style={({ pressed }) => ({ ...card, width: width === 'full' ? undefined : width, alignSelf: width === 'full' ? 'stretch' : undefined, minHeight: 84, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch', opacity: pressed ? .86 : 1 } as ViewStyle)}>
    <View accessible={false} style={{ width: lead.kind === 'thumb' ? 76 : 72, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}><Lead lead={lead} photo={photo} /></View>
    <Perforation vertical />
    <View style={{ flex: 1, minWidth: 0, paddingLeft: 13, paddingRight: 10, paddingVertical: 10, justifyContent: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text numberOfLines={1} className="font-dm-bold text-ink" style={{ flexShrink: 1, fontSize: 14, lineHeight: 19, letterSpacing: -.1 }}>{title}</Text><Tags tags={tags} />
      </View>
      {caption ? <Text numberOfLines={1} className="font-dm" style={{ fontSize: 12, lineHeight: 16, color: colors['fg-muted'] }}>{caption}</Text> : null}
      {pills?.length ? <View style={{ marginTop: 5 }}><Pills pills={pills} /></View>
        : accent ? <Text numberOfLines={1} className="font-dm-medium" style={{ marginTop: 3, fontSize: 11.5, lineHeight: 15, color: colors['fg-accent'] }}>{accent}</Text> : null}
    </View>
    {sidePhoto && photo ? <View accessible={false} style={{ alignSelf: 'center', marginRight: 13 }}><PhotoOrIcon photo={photo} width={58} height={58} radius={13} /></View> : null}
  </Pressable>;
}

/** Square-ish: photo, name and a line, a perforated seam, then pills. */
export function StubPoster({ title, caption, pills, photo, chip, width = 196, onPress, accessibilityLabel, testID }: {
  title: string; caption?: string; pills?: readonly StubPill[]; photo: StubPhoto; chip?: string; width?: number;
  onPress: () => void; accessibilityLabel: string; testID?: string;
}) {
  const colors = useThemeColors(), aurora = useAurora(), card = useAuroraCard();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
    style={({ pressed }) => ({ ...card, width, borderRadius: 18, overflow: 'hidden', paddingBottom: 12, opacity: pressed ? .86 : 1 } as ViewStyle)}>
    <View accessible={false}>
      <PhotoOrIcon photo={photo} width="100%" height={88} radius={0} />
      {chip ? <View style={{ position: 'absolute', left: 8, top: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, overflow: 'hidden', justifyContent: 'center' }}>
        <GradientFill radius={11} /><Text className="font-dm-bold" style={{ fontSize: 11, lineHeight: 14, color: aurora.onFill }}>{chip}</Text>
      </View> : null}
    </View>
    <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 1 }}>
      <Text numberOfLines={2} className="font-dm-bold text-ink" style={{ fontSize: 14, lineHeight: 19, letterSpacing: -.1 }}>{title}</Text>
      {caption ? <Text numberOfLines={1} className="font-dm" style={{ fontSize: 12, lineHeight: 16, color: colors['fg-muted'] }}>{caption}</Text> : null}
    </View>
    {pills?.length ? <><View style={{ marginTop: 10 }}><Perforation vertical={false} /></View><View style={{ paddingHorizontal: 12, marginTop: 9 }}><Pills pills={pills} /></View></> : null}
  </Pressable>;
}

/** A row of stub cards that runs edge to edge and scrolls sideways. */
export function StubRail({ children, testID }: { children: ReactNode; testID?: string }) {
  const gutter = useAppGutter();
  return <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }}
    contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 4, gap: 12, alignItems: 'stretch' }}>{children}</ScrollView>;
}

/** A stack of full-width tickets (category pages, routes, a collection). */
export function StubStack({ children, testID }: { children: ReactNode; testID?: string }) {
  return <View testID={testID} style={{ gap: 10 }}>{children}</View>;
}
