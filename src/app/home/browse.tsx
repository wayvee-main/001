import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Glyph } from '@/components/glyph';
import { HomeGuideHeading, HomeGuideList, HomeGuidePills, HomeGuideScreen } from '@/components/home-field-guide';
import { useActiveCityName } from '@/lib/city';
import { filterHomeGuide, searchHomeGuide, type HomeGuideCategory } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';
import { useThemeColors } from '@/lib/theme';

const NAMES={eat:'Eat',bars:'Bars',routes:'Routes',events:'Events'};
const FILTERS={eat:['All','A good table','Quick bites'],bars:['All','Listening rooms'],routes:['All','Walking','Rides'],events:['All']};

export default function HomeBrowseScreen() {
  const params=useLocalSearchParams<{category?:string;q?:string}>(),colors=useThemeColors(),cityName=useActiveCityName();
  const {catalog,now}=useHomeGuide();
  const category=params.category&&params.category in NAMES?params.category as HomeGuideCategory:undefined;
  const [query,setQuery]=useState(params.q || ''),[filter,setFilter]=useState('All');
  const entries=query.trim()?searchHomeGuide(catalog,query):category?filterHomeGuide(catalog.categories[category],filter):[];
  const subtitle=category?{eat:`${catalog.categories.eat.length} nearby places. A good place to begin.`,bars:'A good drink, and a room with a little soul.',routes:'A few good stops. One easy way through.',events:'A reason to head out.'}[category]:'A place, artist, or good idea.';
  return <HomeGuideScreen now={now} backLabel="Home" search={false}>
    <HomeGuideHeading title={category?NAMES[category]:'Search the city'} subtitle={subtitle} />
    <View className="flex-row items-center gap-x-2 rounded-full border border-edge-card border-b-edge-card-bottom bg-surface-search px-3 shadow-soft-light dark:shadow-soft-dark">
      <Glyph name="search" size={16} color={colors['fg-muted']} />
      <TextInput testID="home-guide-search" accessibilityLabel={`Search the city of ${cityName}`} value={query} onChangeText={setQuery}
        placeholder={`Search the city of ${cityName}`} placeholderTextColor={colors['fg-muted']} className="min-w-0 flex-1 py-3 font-dm text-label text-ink" />
    </View>
    {category&&!query.trim()&&FILTERS[category].length>1?<HomeGuidePills values={FILTERS[category]} value={filter} onChange={setFilter} />:null}
    <HomeGuideList entries={entries} empty={!category&&!query.trim()?'Search for a place, artist, trail or kind of outing.':'Try another filter or check back as local listings update.'} />
  </HomeGuideScreen>;
}
