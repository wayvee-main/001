import { useLocalSearchParams } from 'expo-router';
import { HomeGuideFacts, HomeGuideHeading, HomeGuideScreen } from '@/components/home-field-guide';
import { HomeChapters } from '@/components/home-secondary';
import { EmptyState } from '@/components/ui';
import { DetailAssistantDock } from '@/components/detail-assistant';
import { ledgerContext } from '@/lib/detail-ledger';
import { entriesForHomeCollection, homeGuideKey } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';
import { collectionChapters } from '@/lib/home-secondary';

export default function HomeCollectionScreen() {
  const {id}=useLocalSearchParams<{id?:string}>(),{catalog,now}=useHomeGuide();
  const collection=catalog.entries[homeGuideKey('collection',id || '')];
  const chapters=collectionChapters(entriesForHomeCollection(catalog,id || ''));
  return <HomeGuideScreen now={now} beforeNav={collection?<DetailAssistantDock chevron key={collection.id} context={ledgerContext(collection)} />:undefined}>
    <HomeGuideHeading title={collection?.name || 'Collection unavailable'} subtitle={collection?.description} />
    {collection?<HomeGuideFacts facts={collection.facts} />:null}
    {chapters.length?<HomeChapters key={id} chapters={chapters} />:<EmptyState compact title="No current picks" message="Try another collection from Home." />}
  </HomeGuideScreen>;
}
