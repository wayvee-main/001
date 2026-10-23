import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Text, View } from 'react-native';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { DetailScreen } from '@/components/detail-screen';
import { EmptyState } from '@/components/ui';
import { CRAWLS } from '@/lib/data';
import { useScoper } from '@/lib/store';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return Object.keys(CRAWLS).map((id) => ({ id }));
}

export default function CrawlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const showToast = useScoper((s) => s.showToast);
  const crawl = CRAWLS[id ?? ''];

  if (!crawl) {
    return (
      <Screen>
        <ScreenScroll gap={16}>
          <HeaderRow title="Route unavailable" />
          <EmptyState
            title="This crawl could not be found"
            message="It may have changed. Browse Discover for the current curated night routes."
            actionLabel="Browse Discover"
            onAction={() => router.replace('/discover')}
          />
        </ScreenScroll>
      </Screen>
    );
  }

  return <DetailScreen title={crawl.name} meta={crawl.meta} lede={crawl.desc}
    onAddress={() => Linking.openURL(crawl.routeUrl).catch(() => showToast('Could not open the route in Maps'))}
    facts={[{glyph:'route',label: `${crawl.stops.length} stops`}]}
    sections={[{key:'stops',title:'Along the way',children:<View style={{gap:14}}>{crawl.stops.map((stop,index)=><View key={stop.name} style={{gap:4}}>
      <Text className="font-dm-medium text-label text-ink">{index+1}. {stop.name}</Text>
      <Text className="font-dm text-label text-taupe" style={{lineHeight:19}}>{stop.note}</Text>
    </View>)}</View>}]}
    actions={[{label:'Plan dinner before this route',iconD:'M12 3v18 M3 12h18',onPress:()=>router.push(`/create?crawlId=${crawl.id}&q=${encodeURIComponent(`Dinner before the ${crawl.name} route`)}`)}]}
    navActive="discover" />;
}
