import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { HomeDoorCard, HomeGuideHeading, HomeGuideScreen } from '@/components/home-field-guide';
import { EmptyState } from '@/components/ui';
import { homeCollectionGlyph } from '@/lib/home-discovery';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeCollectionsScreen() {
  const router=useRouter(),{catalog,now}=useHomeGuide();
  return <HomeGuideScreen now={now} backLabel="Home">
    <HomeGuideHeading title="Collections" subtitle="Shortlists for this part of the day." />
    <View className="gap-y-2">{catalog.collections.map(collection=><HomeDoorCard key={collection.id} testID={`home-collection-list-${collection.id}`} title={collection.title} glyph={homeCollectionGlyph(collection.id)}
      meta={`${collection.items.length} picks · ${collection.subtitle.split(' · ').slice(-1)[0]}`} onPress={()=>router.push({pathname:'/home/collection',params:{id:collection.id}})} />)}</View>
    {!catalog.collections.length?<EmptyState compact title="No current shortlists" message="Collections appear as local picks are added." />:null}
  </HomeGuideScreen>;
}
