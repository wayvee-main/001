import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { RaisedView } from '@/components/raised-surface';
import { useScoper } from '@/lib/store';
import { calculateSignalWeight, tasteVocabulary, type TasteProfile } from '@/lib/taste';
import {
  buildTasteProfile,
  eraseLearnedTaste,
  loadConfirmBeforeLearning,
  saveConfirmBeforeLearning,
  saveExcludedTags,
} from '@/lib/taste-profile';
import { useThemeColors } from '@/lib/theme';

const SUGGESTION_CAP = 18;
/** Width of the weight bar at full strength, in px. Bars are drawn to scale off
 * the real decayed weight, so a faded signal is visibly shorter. */
const WEIGHT_BAR_MAX = 56;
const WEIGHT_BAR_FULL = 2.2;

// Tabler's x (icons/outline/x.svg), cropped to its bounding box (6-18, 6-18).
function Cross({ color = '#fff', size = 9 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="6 6 12 12">
      <Path d="M18 6l-12 12 M6 6l12 12" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function LayerHeading({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <View className="gap-y-1">
      <Text className="font-dm-bold text-micro uppercase tracking-wider text-taupe">{title}</Text>
      {blurb ? <Text className="font-dm text-meta text-taupe">{blurb}</Text> : null}
    </View>
  );
}

export default function TasteScreen() {
  const { addTasteTag, removeTasteTag, tasteTags } = useScoper();
  const colors = useThemeColors();
  const [customTag, setCustomTag] = useState('');
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [confirmBeforeLearning, setConfirmBeforeLearning] = useState(true);
  // Snapshot, not a ticking clock — decay only needs to be roughly current for
  // display, and a lazy initializer keeps Date.now() out of the render body.
  const [now] = useState(() => Date.now());
  // Bumped after an action changes what's stored (drop exclusion, erase) so the
  // load effect below re-runs without the effect body itself calling setState.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((token) => token + 1);
  const toldUs = tasteTags;
  const tasteKey = tasteTags.join('|');

  useEffect(() => {
    buildTasteProfile(tasteTags).then(setProfile);
    loadConfirmBeforeLearning().then(setConfirmBeforeLearning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasteKey, reloadToken]);

  // Real cuisines, dish/vibe tags, and nightlife kinds pulled straight from the
  // catalog — every suggestion here is guaranteed to actually shape ranking,
  // never a hardcoded phrase disconnected from what the app can match.
  const vocabulary = useMemo(() => tasteVocabulary(), []);
  const suggestions = vocabulary
    .filter((tag) => !toldUs.some((told) => told.toLowerCase() === tag.toLowerCase()))
    .slice(0, SUGGESTION_CAP);

  const submitCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed) return;
    addTasteTag(trimmed);
    setCustomTag('');
  };

  const observed = profile?.observed ?? [];
  const excluded = profile?.excluded ?? [];

  const dropExclusion = async (tag: string) => {
    const next = excluded.filter((value) => value !== tag);
    await saveExcludedTags(next);
    reload();
  };

  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title="Your taste" />
        <Text className="-mt-1 font-dm text-label leading-[19px] text-taupe">
          Everything we rank with. Edit or erase any of it.
        </Text>

        {/* Stated — the guest's own words. */}
        <View className="gap-y-2.5">
          <LayerHeading title="You told us" />
          {toldUs.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {toldUs.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tag} from your taste profile`}
                  activeOpacity={0.7}
                  onPress={() => removeTasteTag(tag)}
                  className="flex-row items-center gap-x-1.5 rounded-full bg-ember px-3 py-[7px]">
                  <Text className="font-dm-medium text-label text-white">{tag}</Text>
                  <Cross />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="font-dm text-label text-taupe">Nothing yet — add a few below.</Text>
          )}

          <View className="gap-y-2.5 rounded-card border border-sand bg-shell p-3.5 shadow-2xs">
            <Text className="font-dm-medium text-label text-taupe">Add your own</Text>
            <View className="flex-row items-center gap-x-2">
              <TextInput
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="e.g. rooftop views"
                placeholderTextColor={colors.taupe}
                returnKeyType="done"
                onSubmitEditing={submitCustomTag}
                maxLength={40}
                accessibilityLabel="New taste tag"
                className="flex-1 rounded-full border border-sand bg-cream px-3.5 py-2 font-dm text-label text-ink"
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add taste tag"
                activeOpacity={0.75}
                disabled={!customTag.trim()}
                onPress={submitCustomTag}
                style={!customTag.trim() ? { opacity: 0.5 } : undefined}
                className="rounded-full bg-ember px-4 py-2">
                <Text className="font-dm-medium text-label text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {suggestions.length > 0 ? (
            <RaisedView className="gap-y-2 rounded-card p-3.5">
              <Text className="font-dm-medium text-label text-taupe">Or pick from Oakland&apos;s own catalog</Text>
              <View className="flex-row flex-wrap gap-2">
                {suggestions.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${tag} to your taste profile`}
                    activeOpacity={0.7}
                    onPress={() => addTasteTag(tag)}
                    className="rounded-full border border-sand bg-shell px-3 py-[7px]">
                    <Text className="font-dm-medium text-label text-ink">+ {tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </RaisedView>
          ) : null}
        </View>

        {/* Observed — derived from saves and plans, with the evidence that
            produced each one and its real, decayed weight. */}
        <View className="gap-y-2.5">
          <LayerHeading title="We noticed" blurb="From what you saved and planned. Fades if you stop." />
          {observed.length > 0 ? (
            observed.map((signal) => {
              const weight = calculateSignalWeight(signal, now);
              const faded = weight < signal.weight * 0.5;
              return (
                <RaisedView
                  key={`${signal.tag}:${signal.evidence}`}
                  style={faded ? { opacity: 0.6 } : undefined}
                  className="flex-row items-center justify-between rounded-card p-3">
                  <View className="min-w-0 flex-1">
                    <Text className="font-dm-bold text-label text-ink">{signal.tag}</Text>
                    <Text className="mt-0.5 font-dm text-meta text-taupe">{signal.evidence}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-dm-bold text-meta text-pine">+{weight.toFixed(1)}</Text>
                    <View
                      style={{ width: Math.max(6, (weight / WEIGHT_BAR_FULL) * WEIGHT_BAR_MAX) }}
                      className="mt-1 h-1.5 rounded-full bg-pine"
                    />
                  </View>
                </RaisedView>
              );
            })
          ) : (
            <Text className="font-dm text-label text-taupe">
              Nothing learned yet. Save a place or keep a plan and it&apos;ll show up here, with the reason.
            </Text>
          )}
        </View>

        {/* Excluded — the signal most apps throw away. */}
        <View className="gap-y-2.5">
          <LayerHeading title="Not for you" blurb="Ranked down, never hidden — you'll still see them, marked." />
          {excluded.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {excluded.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  accessibilityRole="button"
                  accessibilityLabel={`Stop excluding ${tag}`}
                  activeOpacity={0.7}
                  onPress={() => void dropExclusion(tag)}
                  className="flex-row items-center gap-x-1.5 rounded-full border border-danger/40 bg-danger/10 px-3 py-[7px]">
                  <Text className="font-dm-medium text-label text-danger">{tag}</Text>
                  <Cross color={colors.danger} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="font-dm text-label text-taupe">
              Nothing excluded. Ask for &ldquo;not thai&rdquo; and it lands here.
            </Text>
          )}
        </View>

        <RaisedView className="flex-row items-center justify-between rounded-card p-4">
          <View className="mr-3 flex-1">
            <Text className="font-dm-bold text-label text-ink">Confirm before learning</Text>
            <Text className="mt-0.5 font-dm text-meta text-taupe">
              We&apos;ll ask before adding anything to &ldquo;We noticed&rdquo;.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: confirmBeforeLearning }}
            accessibilityLabel="Confirm before learning"
            activeOpacity={0.8}
            onPress={() => {
              const next = !confirmBeforeLearning;
              setConfirmBeforeLearning(next);
              void saveConfirmBeforeLearning(next);
            }}
            className={`h-6 w-12 justify-center rounded-full p-0.5 ${confirmBeforeLearning ? 'items-end bg-ember' : 'items-start bg-sand'}`}>
            <View className="h-5 w-5 rounded-full bg-white" />
          </TouchableOpacity>
        </RaisedView>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Erase everything we have learned"
          activeOpacity={0.7}
          onPress={() => {
            void eraseLearnedTaste().then(reload);
          }}
          className="items-center py-2">
          <Text className="font-dm-medium text-meta text-danger">Erase everything we&apos;ve learned</Text>
        </TouchableOpacity>
        <Text className="-mt-1 text-center font-dm text-micro text-taupe">
          Clears saves, plan history and exclusions. Your own tags above stay.
        </Text>
      </ScreenScroll>
    </Screen>
  );
}
