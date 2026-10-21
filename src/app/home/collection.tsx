import { useLocalSearchParams } from 'expo-router';
import { HomeGuideFacts, HomeGuideHeading, HomeGuideList, HomeGuideScreen } from '@/components/home-field-guide';
import { entriesForHomeCollection, homeGuideKey } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeCollectionScreen() {
  const {id}=useLocalSearchParams<{id?:string}>(),{catalog,now}=useHomeGuide();
  const collection=catalog.entries[homeGuideKey('collection',id || '')];
  return <HomeGuideScreen now={now}>
    <HomeGuideHeading title={collection?.name || 'Collection unavailable'} subtitle={collection?.description} />
    {collection?<HomeGuideFacts facts={collection.facts} />:null}
    <HomeGuideList entries={entriesForHomeCollection(catalog,id || '')} empty="This shortlist has no current entries. Try another collection from Home." />
  </HomeGuideScreen>;
}
