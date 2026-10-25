import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { HomeDoorCard, HomeGuideHeading, HomeGuideScreen } from '@/components/home-field-guide';
import { HomeChapters } from '@/components/home-secondary';
import { homeDiscoveryIdea, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { homeIdeaPhoto } from '@/lib/home-guide';
import { ideaChapters } from '@/lib/home-secondary';
import { EmptyState } from '@/components/ui';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeIdeasScreen() {
  const {idea:id}=useLocalSearchParams<{idea?:string}>(),router=useRouter(),{catalog,now,displayCity}=useHomeGuide();
  const idea=id?homeDiscoveryIdea(id,now):undefined;
  const chapters=idea?ideaChapters(idea,catalog):[];
  return <HomeGuideScreen now={now} cityLabel={displayCity} backLabel={id?'Back':'Home'}>
    <HomeGuideHeading title={idea?.title || 'For you'} subtitle={idea?.detail || 'Good ideas for this part of the day.'} />
    {idea?(chapters.length?<HomeChapters key={idea.id} chapters={chapters} />:<EmptyState compact title="Local options are on the way" message="Try another idea as the local catalog updates." />):
      <View className="gap-y-2">{homeDiscoveryIdeas(now).map(item=><HomeDoorCard key={item.id} testID={`home-idea-list-${item.id}`} title={item.title} meta={item.detail} image={homeIdeaPhoto(item,catalog)} glyph={item.glyph} onPress={()=>router.push(item.href as never)} />)}</View>}
  </HomeGuideScreen>;
}
