import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Text, View } from 'react-native';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { PlanCta } from '@/components/plan-actions';
import { EmptyState, PrimaryButton } from '@/components/ui';
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

  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title={crawl.name} />
        <Text className="font-dm text-[13px] text-taupe">{crawl.meta}</Text>

        <View className="rounded-card border border-sand bg-coral-50 px-4 py-3.5">
          <Text className="font-dm text-[13.5px] italic leading-5 text-ink">{crawl.desc}</Text>
          <Text className="mt-2 font-dm text-label text-taupe">— Wayvee local team</Text>
        </View>

        <View>
          {crawl.stops.map((st, i) => (
            <View key={st.name} className="flex-row gap-x-3.5">
              <View className="w-[26px] items-center">
                <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-ember">
                  <Text className="font-dm-bold text-label text-white">{i + 1}</Text>
                </View>
                {i < crawl.stops.length - 1 ? <View className="my-1 w-0.5 flex-1 bg-sand" /> : null}
              </View>
              <View className="flex-1 pb-[18px]">
                <Text className="font-dm-medium text-[14.5px] text-ink">{st.name}</Text>
                <Text className="mt-0.5 font-dm text-label text-taupe">{st.note}</Text>
              </View>
            </View>
          ))}
        </View>

        <PrimaryButton label="Start crawl" onPress={() => Linking.openURL(crawl.routeUrl).catch(() => showToast('Could not open the route in Maps'))} />
        <PlanCta
          label={`Plan dinner before the ${crawl.name}`}
          onPress={() => router.push(`/create?crawlId=${crawl.id}&q=${encodeURIComponent(`Dinner before the ${crawl.name} route`)}`)}
        />
        <Text className="text-center font-dm text-label text-taupe">Walking route opens in Maps · stops in order</Text>
      </ScreenScroll>
    </Screen>
  );
}
