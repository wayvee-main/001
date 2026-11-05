import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { IconBadge } from '@/components/aurora';
import { DiscoverDealCard, DiscoverRows, DiscoverSectionHeading, DiscoverShows } from '@/components/discover';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { EmptyState } from '@/components/ui';
import { buildDiscoverGuide, countLabel } from '@/lib/discover-categories';
import { discoverDeals } from '@/lib/discover-deals';
import { promotionForPlacement } from '@/lib/promotions';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

/** One Discover category (or a whole family, or every deal) as a full list. */
export default function DiscoverCategoryScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>(), { catalog, now, displayCity } = useHomeGuide(), colors = useThemeColors();
  const guide = buildDiscoverGuide(catalog), family = guide.families.find(item => item.id === id), category = guide.byId[id];
  const title = id === 'deals' ? 'Deals & happy hours' : category?.title || 'Discover';
  const deals = id === 'deals' ? discoverDeals(catalog, now, [promotionForPlacement('home-food'), promotionForPlacement('ordering-savings'), promotionForPlacement('discover-rides')]) : [];
  const familyName = category ? guide.families.find(item => item.id === category.family)?.title : undefined;
  const count = id === 'deals' ? `${deals.length} near you` : family ? countLabel(family.count, family.unit) : category ? countLabel(category.entries.length + (id === 'shows' ? guide.series.length : 0), id === 'shows' ? ['upcoming', 'upcoming'] : category.unit) : '';
  return <HomeGuideScreen now={now} cityLabel={displayCity} backLabel="Discover" activeTab="discover" context={false}>
    <View testID="discover-category-header" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconBadge glyph={id === 'deals' ? 'tag' : category?.glyph || 'compass'} size={44} iconSize={21} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -.8 }}>{title}</Text>
        <Text className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{[count, familyName && !family ? familyName : '', displayCity].filter(Boolean).join(' · ')}</Text>
      </View>
    </View>
    {id === 'deals' ? (deals.length ? <View style={{ gap: 10 }}>{deals.map(deal => <DiscoverDealCard key={deal.id} deal={deal} width="100%" />)}</View>
      : <EmptyState compact title="No current deals" message="Offers appear here when a venue publishes one." />)
    : family ? family.categories.map(item => <View key={item.id}>
        <DiscoverSectionHeading title={item.title} meta={countLabel(item.entries.length, item.unit)} />
        {item.id === 'shows' ? <DiscoverShows events={item.entries} series={guide.series} /> : <DiscoverRows entries={item.entries} catalog={catalog} now={now} meta={item.meta} />}
      </View>)
    : category ? (id === 'shows' ? <DiscoverShows events={category.entries} series={guide.series} /> : <DiscoverRows entries={category.entries} catalog={catalog} now={now} meta={category.meta} testID="discover-category-row" />)
    : <EmptyState compact title="Nothing here just yet" message="This category is empty in the current catalog." />}
  </HomeGuideScreen>;
}
