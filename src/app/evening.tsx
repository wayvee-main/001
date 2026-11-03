import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { LocalPerksCard, PerksHeading, PerksVeeRibbon } from '@/components/local-perks';
import { homeGuideKey, type HomeGuideEntry } from '@/lib/home-guide';
import { useLocalPerks } from '@/lib/local-perks-store';
import { perksAreaKey, perksEntries } from '@/lib/local-perks';
import { useScoper } from '@/lib/store';
import { todayIso } from '@/lib/stay';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function EveningScreen() {
  const { catalog, now, city } = useHomeGuide(), perks = useLocalPerks(), router = useRouter();
  const area = perksAreaKey(city, useScoper(state => state.deviceLocation));
  const stops = perks.date === todayIso(now) ? perks.stops.filter(stop => stop.city === area) : [];
  const entries = stops.map(stop => catalog.entries[homeGuideKey(stop.kind, stop.id)] || { ...stop, description: '', searchText: '', details: [], links: [] } as HomeGuideEntry);
  const suggestions = [...perksEntries(catalog, 'eat').slice(0, 2), ...perksEntries(catalog, 'bars').slice(0, 2)].filter(entry => !stops.some(stop => homeGuideKey(stop.kind, stop.id) === homeGuideKey(entry.kind, entry.id)));
  return <HomeGuideScreen now={now} search={false} context={false} backLabel="Home">
    <View style={{ gap: 9 }}><Text className="font-dm text-fine uppercase text-taupe" style={{ letterSpacing: .8 }}>Your evening · At your pace</Text>
      <Text accessibilityRole="header" className="font-fraunces text-ink" style={{ fontSize: 32, lineHeight: 36, letterSpacing: -.7 }}>{stops.length ? 'One good thing. Then another.' : 'Start with one good place.'}</Text>
      <Text className="font-dm text-label text-taupe">{stops.length ? 'A few stops. A little room to wander.' : 'Tap + on a place to keep it in tonight’s draft.'}</Text>
    </View>
    {entries.map(entry => <LocalPerksCard key={homeGuideKey(entry.kind, entry.id)} entry={entry} catalog={catalog} />)}
    <PerksVeeRibbon />
    {suggestions.length ? <View style={{ gap: 10 }}><PerksHeading title={stops.length ? 'A little room for more' : 'A few good beginnings'} action="Browse" onPress={() => router.push('/discover')} />
      {suggestions.map(entry => <LocalPerksCard key={homeGuideKey(entry.kind, entry.id)} entry={entry} catalog={catalog} />)}
    </View> : null}
  </HomeGuideScreen>;
}
