import { useLocalSearchParams } from 'expo-router';

import { HomeEntryLedger } from '@/components/home-entry-ledger';
import { HomeGuideHeading, HomeGuideScreen } from '@/components/home-field-guide';
import { EmptyState } from '@/components/ui';
import { buildHomeGuide, homeGuideKey } from '@/lib/home-guide';
import { useRegionalPlace } from '@/lib/use-regional-places';
import { useDetailRefresh } from '@/lib/use-detail-refresh';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function HomeDetailScreen() {
  const params=useLocalSearchParams<{kind?:string|string[];id?:string|string[]}>(),{catalog,now,city}=useHomeGuide();
  const kind=Array.isArray(params.kind)?params.kind[0]:params.kind,id=Array.isArray(params.id)?params.id[0]:params.id;
  useDetailRefresh(kind);
  const catalogEntry=catalog.entries[homeGuideKey(kind||'',id||'')];
  const regional=useRegionalPlace(kind==='place'&&!catalogEntry?id:undefined);
  const entry=catalogEntry||(regional.place?buildHomeGuide({city,now,places:[regional.place],nearest:[],picks:[],events:[],includeOakland:false}).entries[homeGuideKey('place',regional.place.id)]:undefined);
  if(entry)return <HomeEntryLedger entry={entry} />;
  if(regional.pending)return <HomeGuideScreen now={now}><HomeGuideHeading title="Opening this place…" /></HomeGuideScreen>;
  return <HomeGuideScreen now={now}><HomeGuideHeading title="This one has moved on" /><EmptyState compact title="No current listing" message="Head back to Home for the latest local options." /></HomeGuideScreen>;
}
