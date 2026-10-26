import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HomeChapterDoor, HomeChapterHeader, HomeChapterTitle, HomeChapters } from '@/components/home-chapters';
import { homeDiscoveryIdea, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { homeIdeaPhoto } from '@/lib/home-guide';
import { ideaChapters } from '@/lib/home-secondary';
import { EmptyState } from '@/components/ui';
import { useHomeGuide } from '@/lib/use-home-guide';
import { currentDaypart } from '@/lib/daypart';

export default function HomeIdeasScreen() {
  const {idea:id}=useLocalSearchParams<{idea?:string}>(),router=useRouter(),{catalog,now,displayCity}=useHomeGuide();
  const idea=id?homeDiscoveryIdea(id,now):undefined;
  const chapters=idea?ideaChapters(idea,catalog,now):[];
  const period={morning:'This morning',midday:'This afternoon',afternoon:'This afternoon',evening:'This evening',lateNight:'After hours'}[currentDaypart(now)];
  const category=idea?(['food','late-food'].includes(idea.topic)?'Eat':idea.topic==='events'?'Events':idea.topic==='bars'?'Bars':idea.topic==='outdoors'?'Outdoors':undefined):undefined;
  return <HomeGuideScreen now={now} cityLabel={displayCity} backLabel={id?'Back':'Home'} header={false} context={false}>
    <HomeChapterHeader city={displayCity} category={category} />
    <HomeChapterTitle title={idea?.id==='dinner'?'Dinner, without\nthe debate':idea?.title || 'For you'} subtitle={`For you · ${period}`} />
    {idea?(chapters.length?<HomeChapters key={idea.id} variant="ideas" chapters={chapters} />:<EmptyState compact title="Local options are on the way" message="Try another idea as the local catalog updates." />):
      <View style={{gap:10}}>{homeDiscoveryIdeas(now).map(item=><HomeChapterDoor key={item.id} testID={`home-idea-list-${item.id}`} title={item.title} summary={item.detail} image={homeIdeaPhoto(item,catalog)} glyph={item.glyph} onPress={()=>router.push(item.href as never)} />)}</View>}
  </HomeGuideScreen>;
}
