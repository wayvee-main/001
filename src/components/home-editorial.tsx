import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { eventDayGroupLabel, type CuratedCollection, type ScoperEvent } from '@/lib/data';
import { EDITORIAL_FONTS as F, useEditorial } from '@/lib/editorial';
import { formatMiles } from '@/lib/geo';
import type { NearestPlace } from '@/lib/nearby-pool';
import { useWeatherNow, weatherLine } from '@/lib/weather';

/** Exact Editorial reference, expressed in shared web/native primitives. */
export function EditorialHeader({ locationLabel, hasReminders, onLocation, onProfile }: {
  locationLabel: string; hasReminders: boolean; onLocation: () => void; onProfile: () => void;
}) {
  const { c } = useEditorial();
  const weather = useWeatherNow();
  return (
    <View style={styles.header}>
      <View style={styles.grow}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Location: ${locationLabel}. Open city settings`} onPress={onLocation} activeOpacity={0.75} style={styles.city} hitSlop={6}>
          <Text numberOfLines={1} style={[styles.cityName, { color: c.ink }]}>{locationLabel}</Text>
          <Glyph name="chevron-down" size={14} color={c.ink} />
        </TouchableOpacity>
        {weather ? <Text numberOfLines={1} style={[styles.weather, { color: c.muted }]}>{weatherLine(weather)}</Text> : null}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={hasReminders ? 'Your profile and reminders' : 'Your Wayvee profile'} onPress={onProfile} activeOpacity={0.75} hitSlop={4} style={[styles.profile, { backgroundColor: c.surface }]}>
        <Glyph name="user" size={20} color={c.ink} />
        {hasReminders ? <View style={[styles.reminderDot, { backgroundColor: c.coral, borderColor: c.surface }]} /> : null}
      </TouchableOpacity>
    </View>
  );
}

export function EditorialHero({ stayLabel, onAsk, onStay, onLateBites, onOpenLate }: {
  stayLabel: string; onAsk: () => void; onStay: () => void; onLateBites: () => void; onOpenLate: () => void;
}) {
  const { c, heroSize, searchShadow } = useEditorial();
  return (
    <View style={styles.hero}>
      <Text style={[styles.eyebrow, { color: c.coral }]}>YOUR CITY, A LITTLE CLOSER</Text>
      <Text accessibilityRole="header" style={[styles.heroTitle, { color: c.ink, fontSize: heroSize, lineHeight: heroSize * 1.06 }]}>{'Where to\nnext?'}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search places, dishes and shows" onPress={onAsk} activeOpacity={0.8} style={[styles.search, { backgroundColor: c.paper, borderColor: c.line, boxShadow: searchShadow }]}>
        <Glyph name="search" size={19} color={c.muted} strokeWidth={1.8} />
        <Text numberOfLines={1} style={[styles.searchLabel, { color: c.muted }]}>A good bite. A better evening.</Text>
        <View style={[styles.send, { backgroundColor: c.fill }]}><Glyph name="arrow-up-right" size={20} color={c.onFill} /></View>
      </TouchableOpacity>
      <View style={styles.chips}>
        <TouchableOpacity accessibilityRole="button" onPress={onStay} activeOpacity={0.75} hitSlop={6} style={[styles.chip, styles.stayChip, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Glyph name="briefcase" size={13} color={c.ink} /><Text style={[styles.chipText, { color: c.ink }]}>{stayLabel}</Text>
        </TouchableOpacity>
        {[{ label: 'Late bites', onPress: onLateBites }, { label: 'Open late', onPress: onOpenLate }].map((chip) => (
          <TouchableOpacity key={chip.label} accessibilityRole="button" onPress={chip.onPress} activeOpacity={0.75} hitSlop={6} style={[styles.chip, { backgroundColor: c.paper, borderColor: c.line }]}>
            <Text style={[styles.chipText, { color: c.ink }]}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function EditorialCategories({ onEat, onShows, onBars, onRoutes }: {
  onEat: () => void; onShows: () => void; onBars: () => void; onRoutes: () => void;
}) {
  const { c } = useEditorial();
  return (
    <View style={[styles.categories, { borderColor: c.line }]}>
      {[{ label: 'Eat', glyph: 'food', onPress: onEat }, { label: 'Shows', glyph: 'ticket', onPress: onShows }, { label: 'Bars', glyph: 'drink', onPress: onBars }, { label: 'Routes', glyph: 'route', onPress: onRoutes }].map((item) => (
        <TouchableOpacity key={item.label} accessibilityRole="button" onPress={item.onPress} activeOpacity={0.75} style={styles.category}>
          <Glyph name={item.glyph} size={16} color={c.coral} strokeWidth={1.8} /><Text style={[styles.categoryText, { color: c.ink }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function EditorialEvent({ event, now, onPress }: { event: ScoperEvent; now: Date; onPress: () => void }) {
  const { c, photoShade } = useEditorial();
  const category = event.cats.find((cat) => !['Tonight', 'Upcoming'].includes(cat));
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${event.name}, ${event.venue}, ${eventDayGroupLabel(event, now)} ${event.time}`} onPress={onPress} activeOpacity={0.85} style={[styles.event, { backgroundColor: c.dark }]}>
      <Photo uri={event.image} radius={15} style={StyleSheet.absoluteFill} stripedPlaceholder={false} />
      <LinearGradient pointerEvents="none" colors={['transparent', photoShade]} locations={[0.05, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.eventCopy}>
        <View style={styles.grow}>
          <Text numberOfLines={1} style={[styles.eventEyebrow, { color: c.darkMuted }]}>{`${eventDayGroupLabel(event, now)} · ${event.time}`.toUpperCase()}</Text>
          <Text numberOfLines={2} style={[styles.eventTitle, { color: c.onDark }]}>{event.name}</Text>
          <Text numberOfLines={1} style={[styles.eventMeta, { color: c.darkMuted }]}>{[event.venue, category].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={[styles.eventArrow, { backgroundColor: c.paper }]}><Glyph name="arrow-up-right" size={20} color={c.ink} /></View>
      </View>
    </TouchableOpacity>
  );
}

export function EditorialForYouHeading() {
  const { c } = useEditorial();
  return <View style={[styles.forYouHeading, { borderColor: c.line }]}><Text accessibilityRole="header" style={[styles.forYouTitle, { color: c.ink }]}>For you</Text><Text style={[styles.caption, { color: c.muted }]}>Close to your corner.</Text></View>;
}

export function EditorialSubheading({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const { c } = useEditorial();
  return <View style={styles.subheading}><Text accessibilityRole="header" style={[styles.subheadingTitle, { color: c.ink }]}>{title.toUpperCase()}</Text>{onSeeAll ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`} activeOpacity={0.75} onPress={onSeeAll} hitSlop={4} style={styles.seeAll}><Text style={[styles.seeAllText, { color: c.coral }]}>See all</Text><Glyph name="arrow" size={14} color={c.coral} /></TouchableOpacity> : null}</View>;
}

/** Home and See all share this exact unboxed vertical listing shape. */
export function EditorialNearestRow({ entry, last = false, onPress }: { entry: NearestPlace; last?: boolean; onPress: () => void }) {
  const { c, compact } = useEditorial();
  return (
    <TouchableOpacity testID="editorial-nearest-row" accessibilityRole="button" accessibilityLabel={`View ${entry.name}, ${formatMiles(entry.miles)}`} onPress={onPress} activeOpacity={0.75} style={[styles.row, { gap: compact ? 9 : 12, borderBottomWidth: last ? 0 : 1, borderColor: c.line }]}>
      <Photo uri={entry.image} radius={11} style={{ width: compact ? 51 : 58, height: compact ? 55 : 58 }} />
      <View style={styles.grow}>
        <Text numberOfLines={2} style={[styles.rowName, { color: c.ink, fontSize: compact ? 13 : 14 }]}>{entry.name}</Text>
        <Text numberOfLines={1} style={[styles.rowMeta, { color: c.muted }]}>{[entry.cuisine, entry.price].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={[styles.rowEnd, { gap: compact ? 2 : 5 }]}><Text style={[styles.rowDistance, { color: c.ink, fontSize: compact ? 11 : 12 }]}>{formatMiles(entry.miles)}</Text><Glyph name="chevron" size={compact ? 11 : 13} color={c.coral} /></View>
    </TouchableOpacity>
  );
}

export function EditorialCollection({ collection, onPress }: { collection: CuratedCollection; onPress: () => void }) {
  const { c } = useEditorial();
  const outdoor = collection.id === 'outdoor-tables';
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Collection: ${collection.title}`} onPress={onPress} activeOpacity={0.8} style={[styles.collection, { backgroundColor: c.surface }]}>
      <Photo uri={collection.coverImage} radius={9} style={{ width: 73, height: 73 }} />
      <View style={styles.grow}>
        <Text numberOfLines={1} style={[styles.collectionEyebrow, { color: c.violet }]}>WORTH LINGERING</Text>
        <Text numberOfLines={2} style={[styles.collectionTitle, { color: c.ink }]}>{outdoor ? 'Tables in the\nopen air' : collection.title}</Text>
        <Text numberOfLines={2} style={[styles.collectionMeta, { color: c.muted }]}>{outdoor ? 'Patios, good plates, no rush.' : collection.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

export const editorialStyles = StyleSheet.create({
  section: { marginTop: 20 },
  status: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, paddingVertical: 16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 18, paddingBottom: 10 },
  back: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  listTitle: { flex: 1, fontFamily: F.display, fontSize: 25, lineHeight: 27, letterSpacing: -0.7 },
  listCount: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 5 },
  listBlurb: { fontFamily: F.regular, fontSize: 12, lineHeight: 17, marginBottom: 18 },
});

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 15, paddingBottom: 12 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '100%' },
  cityName: { fontFamily: F.strong, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  weather: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4, marginTop: 3 },
  profile: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reminderDot: { position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  hero: { paddingTop: 12, paddingBottom: 20 },
  eyebrow: { fontFamily: F.strong, fontSize: 11, lineHeight: 15.4, letterSpacing: 1.4 },
  heroTitle: { fontFamily: F.display, letterSpacing: -1.3, marginTop: 7, marginBottom: 19 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, borderWidth: 1, borderRadius: 40 },
  searchLabel: { flex: 1, fontFamily: F.regular, fontSize: 13, lineHeight: 18.2 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 30 },
  stayChip: { borderStyle: 'dashed' },
  chipText: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4 },
  categories: { flexDirection: 'row', gap: 4, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  category: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 16 },
  categoryText: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4 },
  event: { height: 156, borderRadius: 15, overflow: 'hidden' },
  eventCopy: { position: 'absolute', bottom: 14, left: 15, right: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  eventEyebrow: { fontFamily: F.strong, fontSize: 10, lineHeight: 14, letterSpacing: 1 },
  eventTitle: { fontFamily: F.strong, fontSize: 21, lineHeight: 29.4, letterSpacing: -0.6, marginTop: 4 },
  eventMeta: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4, marginTop: 2 },
  eventArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  forYouHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, paddingTop: 18 },
  forYouTitle: { fontFamily: F.display, fontSize: 28, lineHeight: 30.8, letterSpacing: -0.55 },
  caption: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4 },
  subheading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, minHeight: 36 },
  subheadingTitle: { fontFamily: F.strong, fontSize: 11, lineHeight: 15.4, letterSpacing: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  seeAllText: { fontFamily: F.strong, fontSize: 12, lineHeight: 16.8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 83 },
  rowName: { fontFamily: F.strong, lineHeight: 16.8, letterSpacing: -0.2 },
  rowMeta: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4, marginTop: 6 },
  rowEnd: { flexDirection: 'row', alignItems: 'center' },
  rowDistance: { fontFamily: F.medium, lineHeight: 16.8, fontVariant: ['tabular-nums'] },
  collection: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 13, marginTop: 7 },
  collectionEyebrow: { fontFamily: F.strong, fontSize: 10, lineHeight: 14, letterSpacing: 0.7, marginBottom: 5 },
  collectionTitle: { fontFamily: F.strong, fontSize: 15, lineHeight: 17.25, letterSpacing: -0.25 },
  collectionMeta: { fontFamily: F.regular, fontSize: 11, lineHeight: 15.4, marginTop: 5 },
});
