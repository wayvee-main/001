import { useLocalSearchParams } from 'expo-router';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { HomeChapterHeader, HomeChapterTitle, HomeChapters } from '@/components/home-chapters';
import { EmptyState } from '@/components/ui';
import { entriesForHomeCollection, homeGuideKey } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';
import { collectionChapters } from '@/lib/home-secondary';

export default function HomeCollectionScreen() {
  const {id}=useLocalSearchParams<{id?:string}>(),{catalog,now,displayCity}=useHomeGuide();
  const collection=catalog.entries[homeGuideKey('collection',id || '')];
  const chapters=collectionChapters(entriesForHomeCollection(catalog,id || ''));
  return <HomeGuideScreen now={now} cityLabel={displayCity} header={false} context={false}>
    <HomeChapterHeader city={displayCity} />
    <HomeChapterTitle title={collection?.name || 'Collection unavailable'} subtitle={`Collection · ${displayCity}`} />
    {chapters.length?<HomeChapters key={id} variant="collection" chapters={chapters} />:<EmptyState compact title="No current picks" message="Try another collection from Home." />}
  </HomeGuideScreen>;
}
