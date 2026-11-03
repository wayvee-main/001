import { NativePressable as Pressable } from '@/components/native-pressable';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { HomeGuideScreen } from '@/components/home-field-guide';
import { LocalPerksBanners, PerksHeading, PerksVeeRibbon } from '@/components/local-perks';
import { Glyph } from '@/components/glyph';
import { EmptyState } from '@/components/ui';
import { compactOffer, localOffers } from '@/lib/local-perks';
import { useLocalPerks } from '@/lib/local-perks-store';
import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';

export default function OffersScreen() {
  const { catalog, now } = useHomeGuide(), colors = useThemeColors(), surface = useRaisedSurface(1), perks = useLocalPerks(), router = useRouter();
  const offers = localOffers(catalog), saved = offers.filter(offer => perks.savedOffers.includes(offer.id));
  const list = (items: typeof offers) => items.map(offer => <Pressable key={offer.id} testID="perks-offer-entry" accessibilityRole="button" accessibilityLabel={`${offer.venue}. ${offer.title}. ${offer.label}`} onPress={() => perks.openOffer(offer)}
    style={({ pressed }) => [surface, { borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', opacity: pressed ? .75 : 1 }]}>
    <Glyph name="tag" size={21} color={colors['fg-accent']} /><View style={{ flex: 1, gap: 4 }}><Text className="font-dm text-fine text-taupe">{offer.venue} · Venue-listed offer</Text>
      <Text numberOfLines={1} className="font-fraunces text-ink" style={{ fontSize: 22, lineHeight: 26 }}>{compactOffer(offer).title}</Text><Text className="font-dm text-fine text-taupe">{compactOffer(offer).detail}</Text>
    </View><Glyph name="chevron" size={14} color={colors['fg-accent']} />
  </Pressable>);
  return <HomeGuideScreen now={now} search={false} context={false} backLabel="Home">
    <View style={{ gap: 7 }}><Text className="font-dm text-fine uppercase text-taupe" style={{ letterSpacing: .8 }}>Offers & good ideas</Text>
      <Text accessibilityRole="header" className="font-fraunces text-ink" style={{ fontSize: 32, lineHeight: 36, letterSpacing: -.7 }}>Good timing looks good on you.</Text>
    </View>
    <LocalPerksBanners catalog={catalog} />
    {saved.length ? <View style={{ gap: 10 }}><PerksHeading title="Kept for later" />{list(saved)}</View> : null}
    <View style={{ gap: 10 }}><PerksHeading title="From the venue" />{offers.length ? list(offers) : <EmptyState compact title="Good things take their time" message="Venue-listed offers appear here when a local source publishes them. There’s still plenty to explore." actionLabel="Discover nearby" onAction={() => router.push('/discover')} />}</View>
    <PerksVeeRibbon />
  </HomeGuideScreen>;
}
