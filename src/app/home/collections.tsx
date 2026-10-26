import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HomeChapterHeader, HomeChapterDoor, HomeChapterTitle } from '@/components/home-chapters';
import { EmptyState } from '@/components/ui';
import { homeCollectionGlyph } from '@/lib/home-discovery';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeCollectionsScreen() {
  const router=useRouter(),{catalog,now,displayCity}=useHomeGuide();
  return <HomeGuideScreen now={now} backLabel="Home" header={false} context={false}>
    <HomeChapterHeader city={displayCity} />
    <HomeChapterTitle title="Collections" subtitle="Shortlists for this part of the day." />
    <View style={{gap:10}}>{catalog.collections.map(collection=><HomeChapterDoor key={collection.id} testID={`home-collection-list-${collection.id}`} title={collection.title} image={collection.coverImage} glyph={homeCollectionGlyph(collection.id)}
      summary={`${collection.items.length} picks · ${collection.subtitle.split(' · ').slice(-1)[0]}`} onPress={()=>router.push({pathname:'/home/collection',params:{id:collection.id}})} />)}</View>
    {!catalog.collections.length?<EmptyState compact title="No current shortlists" message="Collections appear as local picks are added." />:null}
  </HomeGuideScreen>;
}
