import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { CitySearchBar } from '@/components/city-controls';
import { HomeGuideHeading, HomeGuideList, HomeGuidePills, HomeGuideScreen } from '@/components/home-field-guide';
import { useActiveCityName } from '@/lib/city';
import { filterHomeGuide, searchHomeGuide, type HomeGuideCategory } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';

const NAMES={eat:'Eat',bars:'Bars',routes:'Routes',events:'Events'};
const FILTERS={eat:['All','A good table','Quick bites'],bars:['All','Listening rooms'],routes:['All','Walking','Rides'],events:['All']};

export default function HomeBrowseScreen() {
  const params=useLocalSearchParams<{category?:string;q?:string}>(),cityName=useActiveCityName();
  const {catalog,now}=useHomeGuide();
  const category=params.category&&params.category in NAMES?params.category as HomeGuideCategory:undefined;
  const [query,setQuery]=useState(params.q || ''),[filter,setFilter]=useState('All');
  if(!category)return <Redirect href={{pathname:'/search',params:params.q?{q:params.q}:{}}} />;
  const entries=query.trim()?searchHomeGuide(catalog,query):category?filterHomeGuide(catalog.categories[category],filter):[];
  const subtitle=category?{eat:`${catalog.categories.eat.length} nearby places. A good place to begin.`,bars:'A good drink, and a room with a little soul.',routes:'A few good stops. One easy way through.',events:'A reason to head out.'}[category]:'A place, artist, or good idea.';
  return <HomeGuideScreen now={now} backLabel="Home" search={false}>
    <HomeGuideHeading title={category?NAMES[category]:'Search the city'} subtitle={subtitle} />
    <CitySearchBar testID="home-guide-search-bar" inputTestID="home-guide-search" city={cityName} value={query} onChangeText={setQuery} />
    {category&&!query.trim()&&FILTERS[category].length>1?<HomeGuidePills values={FILTERS[category]} value={filter} onChange={setFilter} />:null}
    <HomeGuideList entries={entries} empty={!category&&!query.trim()?'Search for a place, artist, trail or kind of outing.':'Try another filter or check back as local listings update.'} />
  </HomeGuideScreen>;
}
