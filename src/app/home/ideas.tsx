import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { HomeDoorCard, HomeGuideHeading, HomeGuideList, HomeGuideScreen } from '@/components/home-field-guide';
import { homeDiscoveryIdea, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { entriesForHomeIdea } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeIdeasScreen() {
  const {idea:id}=useLocalSearchParams<{idea?:string}>(),router=useRouter(),{catalog,now}=useHomeGuide();
  const idea=id?homeDiscoveryIdea(id,now):undefined;
  return <HomeGuideScreen now={now} backLabel={id?'Back':'Home'}>
    <HomeGuideHeading title={idea?.title || 'For you'} subtitle={idea?.detail || 'Good ideas for this part of the day.'} />
    {idea?<HomeGuideList entries={entriesForHomeIdea(idea,catalog)} empty="Local options for this idea appear as the catalog updates." />:
      <View className="gap-y-2">{homeDiscoveryIdeas(now).map(item=><HomeDoorCard key={item.id} title={item.title} meta={item.detail} glyph={item.glyph} onPress={()=>router.push(item.href as never)} />)}</View>}
  </HomeGuideScreen>;
}
