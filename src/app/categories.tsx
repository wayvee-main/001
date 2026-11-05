import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AuroraList, AuroraRow, IconBadge } from '@/components/aurora';
import { categoryHref, DiscoverSectionHeading } from '@/components/discover';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { buildDiscoverGuide, countLabel, type DiscoverCategory } from '@/lib/discover-categories';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

/** Every Discover category, grouped by family, each opening its own list. */
export default function DiscoverCategoriesScreen() {
  const router = useRouter(), { catalog, now, displayCity } = useHomeGuide(), colors = useThemeColors(), guide = buildDiscoverGuide(catalog);
  const list = (categories: DiscoverCategory[]) => <AuroraList>{categories.map((category, index) => <AuroraRow key={category.id} testID={`discover-category-${category.id}`} divider={index > 0}
    title={category.title} subtitle={category.entries.slice(0, 3).map(entry => entry.name).join(', ')} trailing={String(category.entries.length)}
    accessibilityLabel={`${category.title}. ${countLabel(category.entries.length, category.unit)}`} leading={<IconBadge glyph={category.glyph} size={40} iconSize={19} />}
    onPress={() => router.push(categoryHref(category.id) as never)} />)}</AuroraList>;
  return <HomeGuideScreen now={now} cityLabel={displayCity} backLabel="Discover" activeTab="discover" context={false}>
    <View>
      <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -.8 }}>All categories</Text>
      <Text className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{`${guide.all.length} ways into ${displayCity}`}</Text>
    </View>
    {guide.shortcuts.length ? <View><DiscoverSectionHeading title="Across the city" meta="Open late, happy hours and more" />{list(guide.shortcuts)}</View> : null}
    {guide.families.filter(family => family.categories.length).map(family => <View key={family.id}>
      <DiscoverSectionHeading title={family.title} meta={countLabel(family.count, family.unit)} action="See all" onPress={() => router.push(categoryHref(family.id) as never)} />
      {list(family.categories)}
    </View>)}
  </HomeGuideScreen>;
}
