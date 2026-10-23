import { useLocalSearchParams } from 'expo-router';

import { HomeEntryLedger } from '@/components/home-entry-ledger';
import { HomeGuideHeading, HomeGuideScreen } from '@/components/home-field-guide';
import { EmptyState } from '@/components/ui';
import { homeGuideKey } from '@/lib/home-guide';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeDetailScreen() {
  const params=useLocalSearchParams<{kind?:string|string[];id?:string|string[]}>(),{catalog,now}=useHomeGuide();
  const kind=Array.isArray(params.kind)?params.kind[0]:params.kind,id=Array.isArray(params.id)?params.id[0]:params.id;
  const entry=catalog.entries[homeGuideKey(kind||'',id||'')];
  if(entry)return <HomeEntryLedger entry={entry} />;
  return <HomeGuideScreen now={now}><HomeGuideHeading title="This one has moved on" /><EmptyState compact title="No current listing" message="Head back to Home for the latest local options." /></HomeGuideScreen>;
}
