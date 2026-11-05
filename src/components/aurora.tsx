import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { MetadataLine, MetadataPill } from '@/components/metadata-pill';
import { Glyph } from '@/components/glyph';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { Photo } from '@/components/photo';
import type { PhotoCandidate } from '@/components/reliable-image';
import { gradientColors, useAurora } from '@/lib/aurora';
import { compactCardText, metadataParts, numericDistanceLabel, shortCardTitle } from '@/lib/card-presentation';
import { homeCardMetadata } from '@/lib/card-metadata';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import { useThemeColors } from '@/lib/theme';
import { useEntryActions } from '@/lib/use-entry-actions';

/* Aurora — the Vee spiral's gold → ember → violet as the light source. Glow,
 * gradient fills and per-glyph gradient type are drawn with react-native-svg
 * and expo-linear-gradient, both already shipped, so this ships over the air. */

const GLOW_SPOTS = [
  { cx: '8%', cy: '6%', rx: '50%', ry: '36%', stop: 0 },
  { cx: '96%', cy: '2%', rx: '56%', ry: '40%', stop: 2 },
  { cx: '56%', cy: '32%', rx: '64%', ry: '34%', stop: 1 },
] as const;

/** Screen-top light. Static, decorative and behind everything. */
export function AuroraGlow({ height = 600 }: { height?: number }) {
  const aurora = useAurora(), id = 'aurora' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return <View testID="aurora-glow" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', left: 0, right: 0, top: 0, height }}>
    <Svg width="100%" height="100%">
      <Defs>{GLOW_SPOTS.map((spot, index) => {
        const glow = aurora.glow[spot.stop];
        return <RadialGradient key={index} id={`${id}-${index}`} cx={spot.cx} cy={spot.cy} rx={spot.rx} ry={spot.ry} fx={spot.cx} fy={spot.cy}>
          <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
          <Stop offset="0.7" stopColor={glow.color} stopOpacity={0} />
        </RadialGradient>;
      })}</Defs>
      {GLOW_SPOTS.map((_, index) => <Rect key={index} x="0" y="0" width="100%" height="100%" fill={`url(#${id}-${index})`} />)}
    </Svg>
  </View>;
}

/** The filled-control gradient, laid under a control's content. */
export function GradientFill({ radius = 999, soft = false }: { radius?: number; soft?: boolean }) {
  const aurora = useAurora();
  return <LinearGradient testID={soft ? 'aurora-soft-fill' : 'aurora-fill'} pointerEvents="none" colors={soft ? [...aurora.soft] : [...aurora.fill]}
    start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />;
}

/** Gradient type for a short headline phrase. Render inside a parent Text so it
 * wraps and reads with the rest of the sentence. */
export function GradientText({ text }: { text: string }) {
  const aurora = useAurora(), glyphs = Array.from(text), colors = gradientColors(aurora.text, glyphs.length);
  return <>{glyphs.map((glyph, index) => <Text key={index} style={{ color: colors[index] }}>{glyph}</Text>)}</>;
}

/** Frosted, translucent surface for controls that sit on the glow. */
export function useGlass(): ViewStyle {
  const aurora = useAurora();
  return { backgroundColor: aurora.glass, borderWidth: 1, borderColor: aurora.glassEdge };
}

/** Opaque card surface with Aurora's hairline and lift. */
export function useAuroraCard(): ViewStyle {
  const colors = useThemeColors(), aurora = useAurora();
  return { backgroundColor: colors['surface-raised'], borderWidth: 1, borderColor: aurora.glassEdge, boxShadow: aurora.shadow } as ViewStyle;
}

/** Gradient-tinted circle around an accent glyph. */
export function IconBadge({ glyph, size = 38, iconSize = 18, testID }: { glyph: string; size?: number; iconSize?: number; testID?: string }) {
  const colors = useThemeColors();
  return <View testID={testID} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <GradientFill radius={size / 2} soft />
    <View><Glyph name={glyph} size={iconSize} color={colors['fg-accent']} strokeWidth={1.7} /></View>
  </View>;
}

/** Hairline between top-level sections. `spacing` is added on both sides. */
export function SectionRule({ spacing = 12, testID = 'section-rule' }: { spacing?: number; testID?: string }) {
  const aurora = useAurora();
  return <View testID={testID} accessible={false} style={{ height: 1, backgroundColor: aurora.rule, marginVertical: spacing }} />;
}

/** Small gradient pill with a glyph, for a poster's one-line category. */
export function AuroraChip({ label, glyph }: { label: string; glyph?: string }) {
  const aurora = useAurora();
  return <View testID="aurora-chip" style={{ alignSelf: 'flex-start', height: 26, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
    <GradientFill radius={13} />
    {glyph ? <View><Glyph name={glyph} size={13} color={aurora.onFill} strokeWidth={2} /></View> : null}
    <Text numberOfLines={1} className="font-dm-medium" style={{ fontSize: 12, lineHeight: 16, color: aurora.onFill }}>{label}</Text>
  </View>;
}

/** Dark frosted round button laid over a photo. */
function PhotoAction({ glyph, label, selected, onPress, testID, style }: { glyph: string; label: string; selected?: boolean; onPress: () => void; testID?: string; style: ViewStyle }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: Boolean(selected) }} onPress={onPress} hitSlop={6}
    style={({ pressed }) => ({ position: 'absolute', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20, 12, 22, 0.42)', opacity: pressed ? 0.7 : 1, ...style })}>
    <Glyph name={glyph} size={17} color="#FFFFFF" strokeWidth={1.9} />
  </Pressable>;
}

/** Photo with Aurora's scrim. The fallback stays dark so overlay type reads with or without a photo. */
function OverlayPhoto({ uri, photos, glyph, label }: { uri?: string; photos?: readonly PhotoCandidate[]; glyph?: string; label: string }) {
  const aurora = useAurora();
  return <>
    <Photo uri={uri} candidates={photos} radius={0} stripedPlaceholder={false} retryable={false} fallbackGlyph={glyph as never} fallbackLabel={label} inkColor="rgba(255, 255, 255, 0.72)"
      style={[StyleSheet.absoluteFill, { backgroundColor: aurora.photoFallback }]} />
    <LinearGradient pointerEvents="none" colors={[...aurora.scrim]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
  </>;
}

/** The one overlay-card recipe: photo, scrim, then type at the foot. */
export function AuroraPhotoCard({ title, meta, image, photos, glyph = 'compass', width, height, radius = 22, titleSize = 16, onPress, testID, accessibilityLabel, children, footer, style, metadataInset = 0 }: {
  title: string; meta?: string; image?: string; photos?: readonly PhotoCandidate[]; glyph?: string; width?: number; height: number; radius?: number;
  titleSize?: number; metadataInset?: number; onPress: () => void; testID?: string; accessibilityLabel?: string; children?: ReactNode; footer?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const aurora = useAurora();
  return <View testID={testID ? `${testID}-frame` : undefined} style={[{ width, height, borderRadius: radius, overflow: 'hidden', flexShrink: 0, backgroundColor: aurora.photoFallback, boxShadow: aurora.shadow } as ViewStyle, style]}>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || [title, meta].filter(Boolean).join('. ')} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.88 : 1 })}>
      <OverlayPhoto uri={image} photos={photos} glyph={glyph} label={`${title} photo unavailable`} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: footer ? 64 : 14, bottom: 13, gap: 3 }}>
        <Text numberOfLines={2} className="font-dm-medium" style={{ fontSize: titleSize, lineHeight: Math.round(titleSize * 1.25), letterSpacing: -0.2, color: aurora.onPhoto }}>{shortCardTitle(title)}</Text>
        {meta ? <View style={{ paddingRight: metadataInset }}><MetadataLine text={meta} /></View> : null}
        {footer}
      </View>
    </Pressable>
    {children}
  </View>;
}

/** A listing as an overlay card, with its real save and add-to-evening actions. */
export function AuroraEntryCard({ entry, catalog, width, height, meta, titleSize, testID = 'aurora-entry-card' }: {
  entry: HomeGuideEntry; catalog: HomeGuideCatalog; width: number; height: number; meta?: string; titleSize?: number; testID?: string;
}) {
  const router = useRouter(), { saved, canSave, save, added, add } = useEntryActions(entry);
  return <AuroraPhotoCard testID={testID} title={entry.name} meta={meta ?? entry.caption} photos={homeIndexPhotos(entry, catalog)} glyph={entry.glyph}
    width={width} height={height} titleSize={titleSize} metadataInset={40} onPress={() => router.push(homeGuideHref(entry) as never)} accessibilityLabel={`Explore ${entry.name}. ${entry.caption}`}>
    {canSave ? <PhotoAction testID="perks-save-place" glyph={saved ? 'check' : 'heart'} label={`${saved ? 'Unsave' : 'Save'} ${entry.name}`} selected={saved} onPress={save} style={{ top: 10, right: 10 }} /> : null}
    <PhotoAction testID="perks-add-stop" glyph={added ? 'check' : 'plus'} label={`${added ? 'Remove' : 'Add'} ${entry.name} ${added ? 'from' : 'to'} your evening`} selected={added} onPress={add} style={{ bottom: 12, right: 10 }} />
  </AuroraPhotoCard>;
}

/** Featured pick as a split card: the photo on top (label and save over it), then the
 * name, a one-line snapshot and up to two source-backed facts as pills on a solid panel,
 * with add-to-evening at the right. Type never sits on the photo, so it reads with or
 * without one. */
export function AuroraPoster({ entry, catalog, now, photoHeight = 168, chip, subtitle, testID = 'aurora-poster' }: {
  entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date; photoHeight?: number; chip?: { label: string; glyph?: string }; subtitle?: string; testID?: string;
}) {
  const router = useRouter(), colors = useThemeColors(), aurora = useAurora(), card = useAuroraCard(), { width } = useWindowDimensions();
  const { saved, canSave, save, added, add } = useEntryActions(entry);
  const description = subtitle ?? (entry.detailContent?.description || entry.description || entry.caption);
  const facts = homeCardMetadata(entry, now);
  const narrow = width <= 360, imageHeight = narrow ? Math.round(photoHeight * 0.9) : photoHeight;
  return <View testID={`${testID}-frame`} style={[card, { borderRadius: 24, overflow: 'hidden' }]}>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${description}`} onPress={() => router.push(homeGuideHref(entry) as never)}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <View testID={`${testID}-photo`} style={{ height: imageHeight, overflow: 'hidden', backgroundColor: aurora.photoFallback }}>
        <Photo candidates={homeIndexPhotos(entry, catalog)} radius={0} stripedPlaceholder={false} retryable={false} fallbackGlyph={entry.glyph as never}
          fallbackLabel={`${entry.name} photo unavailable`} inkColor="rgba(255, 255, 255, 0.72)" style={[StyleSheet.absoluteFill, { backgroundColor: aurora.photoFallback }]} />
        <LinearGradient pointerEvents="none" colors={['rgba(14, 8, 16, 0.32)', 'rgba(14, 8, 16, 0)']} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
        {chip ? <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12 }}><AuroraChip label={chip.label} glyph={chip.glyph} /></View> : null}
      </View>
      <View style={{ paddingTop: 13, paddingBottom: 14, paddingLeft: 16, paddingRight: 68, gap: 1 }}>
        <Text numberOfLines={2} className="font-dm-bold text-ink" style={{ fontSize: narrow ? 20 : 21, lineHeight: 26, letterSpacing: -0.6 }}>{shortCardTitle(entry.name)}</Text>
        {description ? <Text testID={`${testID}-description`} numberOfLines={1} ellipsizeMode="tail" className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{compactCardText(description)}</Text> : null}
        {facts.length ? <View testID="aurora-poster-facts" style={{ flexDirection: 'row', gap: 6, marginTop: 9 }}>
          {facts.map(fact => <MetadataPill key={fact.key} text={fact.text} label={fact.label} glyph={fact.glyph} tone={fact.tone} />)}
        </View> : null}
      </View>
    </Pressable>
    {canSave ? <PhotoAction testID="aurora-poster-save" glyph={saved ? 'check' : 'heart'} label={`${saved ? 'Unsave' : 'Save'} ${entry.name}`} selected={saved} onPress={save} style={{ top: 10, right: 10 }} /> : null}
    <Pressable testID="aurora-poster-add" accessibilityRole="button" accessibilityLabel={`${added ? 'Remove' : 'Add'} ${entry.name} ${added ? 'from' : 'to'} your evening`} accessibilityState={{ selected: added }} onPress={add} hitSlop={4}
      style={({ pressed }) => ({ position: 'absolute', right: 14, bottom: 14, width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
      <GradientFill radius={21} />
      <View><Glyph name={added ? 'check' : 'plus'} size={19} color={aurora.onFill} strokeWidth={2.2} /></View>
    </Pressable>
  </View>;
}

/** Grouped list card; children are AuroraRow elements. */
export function AuroraList({ children, testID }: { children: ReactNode; testID?: string }) {
  const card = useAuroraCard();
  return <View testID={testID} style={[card, { borderRadius: 22, overflow: 'hidden' }]}>{children}</View>;
}

/** One row of a grouped list. `divider` draws the hairline above every row but the first. */
export function AuroraRow({ leading, title, subtitle, metadata, trailing, chevron = true, divider = false, onPress, testID, accessibilityLabel }: {
  leading?: ReactNode; title: string; subtitle?: string; metadata?: string; trailing?: string; chevron?: boolean; divider?: boolean; onPress: () => void; testID?: string; accessibilityLabel?: string;
}) {
  const colors = useThemeColors(), aurora = useAurora();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || [title, subtitle, trailing].filter(Boolean).join('. ')} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 16,
      borderTopWidth: divider ? 1 : 0, borderTopColor: aurora.glassEdge, opacity: pressed ? 0.72 : 1 })}>
    {leading}
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={2} className="font-dm-medium text-ink" style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.2 }}>{shortCardTitle(title)}</Text>
      {metadata ? <MetadataLine text={metadata} /> : subtitle ? <Text numberOfLines={1} className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{compactCardText(subtitle)}</Text> : null}
    </View>
    {trailing ? <View style={{ maxWidth: '40%' }}><MetadataPill text={trailing} tone="distance" /></View> : null}
    {chevron ? <Glyph name="chevron" size={16} color={colors['fg-muted']} strokeWidth={1.8} /> : null}
  </Pressable>;
}

/** Calm-list row: a 56px photo, the name, one muted line of facts and a chevron. */
export function AuroraLinkRow({ title, meta, image, photos, glyph = 'compass', divider, onPress, testID, accessibilityLabel }: {
  title: string; meta?: string; image?: string; photos?: readonly PhotoCandidate[]; glyph?: string; divider?: boolean; onPress: () => void; testID?: string; accessibilityLabel?: string;
}) {
  return <AuroraRow testID={testID} divider={divider} title={title} subtitle={meta} onPress={onPress} accessibilityLabel={accessibilityLabel || [title, meta].filter(Boolean).join('. ')}
    leading={<Photo uri={image} candidates={photos} radius={16} stripedPlaceholder={false} retryable={false} fallbackGlyph={glyph as never}
      fallbackLabel={`Photo unavailable for ${title}`} style={{ width: 56, height: 56 }} />} />;
}

/** Up to two facts as one quiet line: what it is, then its distance when measured. */
export function calmMeta(caption: string, distance?: string): string {
  const parts = metadataParts(caption), place = distance ? numericDistanceLabel(distance) : '';
  // A route's stop count can arrive as both its first caption part and its location fact.
  const fresh = place && !parts.some(part => part.toLowerCase() === place.toLowerCase());
  return (fresh ? [parts[0], place] : parts.slice(0, 2)).filter(Boolean).join(' · ');
}

/** A listing as a calm-list row. */
export function AuroraEntryRow({ entry, catalog, now, divider, trailing, testID = 'aurora-entry-row' }: {
  entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date; divider?: boolean; trailing?: string; testID?: string;
}) {
  const router = useRouter(), price = entry.facts.find(fact => fact.glyph === 'wallet')?.value;
  const distance = trailing ?? homeCardMetadata(entry, now).find(item => item.tone === 'distance')?.text ?? price;
  const meta = calmMeta(entry.caption, distance);
  return <AuroraLinkRow testID={testID} divider={divider} title={entry.name} meta={meta} photos={homeIndexPhotos(entry, catalog)} glyph={entry.glyph}
    accessibilityLabel={`Explore ${entry.name}. ${meta}`} onPress={() => router.push(homeGuideHref(entry) as never)} />;
}
