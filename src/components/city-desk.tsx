import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GradientText, useAuroraCard } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { MetadataLine, MetadataPill } from '@/components/metadata-pill';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { Photo } from '@/components/photo';
import { StubTicket } from '@/components/stub-cards';
import { useAurora } from '@/lib/aurora';
import { compactCardText, shortCardTitle } from '@/lib/card-presentation';
import { homeCardMetadata } from '@/lib/card-metadata';
import { currentDaypart } from '@/lib/daypart';
import type { DiscoverCategory, DiscoverFamily } from '@/lib/discover-categories';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import type { PhotoCandidate } from '@/components/reliable-image';
import { dateLead } from '@/lib/stub-cards';
import { useThemeColors } from '@/lib/theme';
import { headingStyle } from '@/lib/typography';
import { useEntryActions } from '@/lib/use-entry-actions';
import { useWeatherNow, weatherLine } from '@/lib/weather';

/** City Desk uses the existing Mist/Nightfall roles on opaque, quiet surfaces. */
export function CityDeskHeadline({ children, accent }: { children: ReactNode; accent: string }) {
  return <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 28, lineHeight: 33, letterSpacing: -.8 }}>
    {children}{'\n'}<Text style={headingStyle(28)}><GradientText text={accent} /></Text>
  </Text>;
}

export function CityDeskWeather({ city }: { city: string }) {
  const colors = useThemeColors(), weather = useWeatherNow();
  const summary = weather ? weatherLine(weather) : 'Weather unavailable';
  return <View testID="home-weather" accessible accessibilityLabel={`${city} weather. ${summary}`} style={{ minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Glyph name="cloud" size={15} color={colors['fg-muted']} />
    <Text numberOfLines={1} className="font-dm" style={{ flexShrink: 1, fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{summary}</Text>
  </View>;
}

export function cityDeskHomeHeadline(now: Date): [string, string] {
  switch (currentDaypart(now)) {
    case 'morning': return ['Coffee looks ', 'promising.'];
    case 'midday': return ['Lunch has ', 'plans.'];
    case 'afternoon': return ['A little ', 'detour?'];
    case 'evening': return ['Make tonight ', 'yours.'];
    case 'lateNight': return ['One more ', 'stop?'];
  }
}

export function CityDeskHomeIntro({ now }: { now: Date }) {
  const [lead, accent] = cityDeskHomeHeadline(now);
  return <Text testID="daybreak-intro" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8}
    className="font-dm-bold text-ink" style={{ fontSize: 28, lineHeight: 36, letterSpacing: -.8 }}>
    {lead}<Text style={headingStyle(28)}><GradientText text={accent} /></Text>
  </Text>;
}

export function CityDeskSection({ title, action = 'See all', onMore, children, testID }: { title: string; action?: string; onMore?: () => void; children: ReactNode; testID?: string }) {
  const colors = useThemeColors();
  return <View testID={testID} style={{ gap: 11 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Text accessibilityRole="header" className="text-ink" style={[headingStyle(22), { flexShrink: 1 }]}>{title}</Text>
      {onMore ? <Pressable accessibilityRole="button" accessibilityLabel={`${action} ${title.toLowerCase()}`} onPress={onMore} hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => ({ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 3, opacity: pressed ? .7 : 1 })}>
        <Text className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{action}</Text><Glyph name="chevron" size={13} color={colors['fg-muted']} />
      </Pressable> : null}
    </View>
    {children}
  </View>;
}

/** A compact ticket retains the entry's source facts, photo and real destination. */
export function CityDeskTicket({ entry, catalog, now, testID }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date; testID?: string }) {
  const router = useRouter();
  const facts = homeCardMetadata(entry, now);
  return <StubTicket testID={testID} appearance="citydesk" width="full" lead={entry.kind === 'event' ? dateLead(entry.startsAt) || { kind: 'thumb' } : { kind: 'thumb' }}
    title={shortCardTitle(entry.name)} caption={compactCardText(entry.caption)} pills={facts.map(fact => ({ text: fact.text, glyph: fact.glyph }))}
    photo={{ candidates: homeIndexPhotos(entry, catalog), glyph: entry.glyph, label: `${entry.name} photo unavailable` }}
    onPress={() => router.push(homeGuideHref(entry) as never)} accessibilityLabel={[entry.name, entry.caption, ...facts.map(fact => fact.label)].filter(Boolean).join('. ')} />;
}

/** Discover's compact, solid card: an inset photograph, two facts and real actions. */
export function CityDeskFeature({ entry, catalog, now }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date }) {
  const router = useRouter(), colors = useThemeColors(), card = useAuroraCard('citydesk');
  const { saved, canSave, save, added, add } = useEntryActions(entry);
  const facts = homeCardMetadata(entry, now), description = entry.detailContent?.description || entry.description || entry.caption;
  const open = () => router.push(homeGuideHref(entry) as never);
  return <View testID="citydesk-feature" style={[card, { borderRadius: 18, overflow: 'hidden' }]}>
    <Pressable testID="citydesk-feature-open" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${description}`} onPress={open} style={({ pressed }) => ({ opacity: pressed ? .85 : 1 })}>
      <View style={{ padding: 10, paddingBottom: 0 }}><Photo candidates={homeIndexPhotos(entry, catalog)} radius={11} retryable={false} stripedPlaceholder={false} fallbackGlyph={entry.glyph as never}
        fallbackLabel={`${entry.name} photo unavailable`} style={{ width: '100%', height: 110, backgroundColor: colors['surface-sunk'] }} /></View>
    </Pressable>
    <View style={{ padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}`} onPress={open} style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} className="font-dm-medium text-ink" style={{ fontSize: 19, lineHeight: 24, letterSpacing: -.4 }}>{shortCardTitle(entry.name)}</Text>
          <Text numberOfLines={1} className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{compactCardText(entry.caption)}</Text>
        </Pressable>
        {canSave ? <Pressable testID="citydesk-feature-save" accessibilityRole="button" accessibilityLabel={`${saved ? 'Unsave' : 'Save'} ${entry.name}`} accessibilityState={{ selected: saved }} onPress={save} hitSlop={4}
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: saved ? colors['accent-tint'] : colors['surface-sunk'], alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}>
          <Glyph name={saved ? 'check' : 'bookmark'} size={16} color={saved ? colors['pill-ink'] : colors['fg-muted']} />
        </Pressable> : null}
      </View>
      {facts.length ? <MetadataLine items={facts} /> : null}
      <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors['control-edge'], paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`More about ${entry.name}. ${description}`} onPress={open} style={{ flex: 1, minWidth: 0, minHeight: 30, justifyContent: 'center' }}>
          <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{compactCardText(description)}</Text>
        </Pressable>
        <Pressable testID="citydesk-feature-add" accessibilityRole="button" accessibilityLabel={`${added ? 'Remove' : 'Add'} ${entry.name} ${added ? 'from' : 'to'} your evening`} accessibilityState={{ selected: added }} onPress={add} hitSlop={5}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors['accent-tint'], alignItems: 'center', justifyContent: 'center' }}>
          <Glyph name={added ? 'check' : 'plus'} size={16} color={colors['pill-ink']} />
        </Pressable>
      </View>
    </View>
  </View>;
}

export function CityDeskFamilyTabs({ families, selected, onSelect }: { families: DiscoverFamily[]; selected?: string; onSelect: (id: DiscoverFamily['id']) => void }) {
  const colors = useThemeColors();
  return <ScrollView testID="citydesk-family-tabs" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6 }}>{families.map(family => {
      const active = selected === family.id;
      return <Pressable key={family.id} testID={`citydesk-family-${family.id}`} accessibilityRole="tab" accessibilityLabel={family.title} accessibilityState={{ selected: active }} aria-selected={active} onPress={() => onSelect(family.id)}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: active ? colors['accent-tint'] : colors['control-edge'], backgroundColor: active ? colors['accent-tint'] : colors.bg, opacity: pressed ? .7 : 1 })}>
        <Text className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: active ? colors['pill-ink'] : colors['fg-muted'] }}>{family.title}</Text>
      </Pressable>;
    })}</View>
  </ScrollView>;
}

/** Browse stays within reach without another block of photo posters. */
export function CityDeskBrowse({ categories, onSelect }: { categories: DiscoverCategory[]; onSelect: (id: string) => void }) {
  const colors = useThemeColors();
  return <View testID="discover-browse" style={{ gap: 8 }}>{Array.from({ length: Math.ceil(categories.length / 2) }, (_, index) => <View key={index} style={{ flexDirection: 'row', gap: 8 }}>
    {categories.slice(index * 2, index * 2 + 2).map(category => <Pressable key={category.id} testID={`discover-browse-${category.id}`} accessibilityRole="button" accessibilityLabel={`${category.title}. ${category.entries.length} options`} onPress={() => onSelect(category.id)}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors['control-edge'], backgroundColor: colors['surface-raised'], padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? .7 : 1 })}>
      <Glyph name={category.glyph} size={17} color={colors['pill-ink']} /><Text numberOfLines={2} className="font-dm" style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, color: colors.fg }}>{category.title}</Text>
    </Pressable>)}
    {categories.length % 2 && index === Math.floor(categories.length / 2) ? <View style={{ flex: 1 }} /> : null}
  </View>)}</View>;
}

export function CityDeskPosterGrid({ children }: { children: (width: number) => ReactNode }) {
  const [width, setWidth] = useState(0);
  return <View testID="citydesk-poster-grid" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {width > 0 ? children(Math.max(0, (width - 10) / 2)) : null}
  </View>;
}

export function CityDeskPoster({ title, caption, photos, glyph, count, width, onPress }: { title: string; caption?: string; photos: readonly PhotoCandidate[]; glyph: string; count: number; width: number; onPress: () => void }) {
  const colors = useThemeColors(), card = useAuroraCard('citydesk'), aurora = useAurora();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${count} picks. ${caption || ''}`} onPress={onPress}
    style={({ pressed }) => ({ ...card, width, borderRadius: 18, overflow: 'hidden', padding: 8, opacity: pressed ? .8 : 1 })}>
    <Photo candidates={photos} radius={11} retryable={false} stripedPlaceholder={false} fallbackGlyph={glyph as never} fallbackLabel={`${title} photo unavailable`} style={{ width: '100%', height: 88, backgroundColor: colors['surface-sunk'] }} />
    <View style={{ paddingHorizontal: 3, paddingTop: 10, gap: 4 }}>
      <Text numberOfLines={1} className="font-dm-medium text-ink" style={{ fontSize: 14, lineHeight: 19 }}>{shortCardTitle(title)}</Text>
      {caption ? <Text numberOfLines={1} className="font-dm" style={{ fontSize: 11, lineHeight: 16, color: colors['fg-muted'] }}>{compactCardText(caption)}</Text> : null}
      <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: aurora.rule, paddingTop: 9, marginTop: 5, paddingBottom: 3, alignItems: 'flex-start' }}><MetadataPill text={`${count} ${count === 1 ? 'pick' : 'picks'}`} glyph={glyph} /></View>
    </View>
  </Pressable>;
}
