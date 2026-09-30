import { Text, TouchableOpacity, View } from 'react-native';

/** The heading above a block of rows, with an optional way into the rest of it.
 *
 * There were three of these — Home's, Discover's and the food hub's — drawn
 * separately with drifting type sizes and mutually exclusive right-hand slots
 * (one took a link, one took a plain note). Six "See all" entry points hanging
 * off three near-identical components is how they drift apart, so this is the
 * one definition: `action` + `onPress` for a link, `note` for a label that is
 * only telling you something. */
export function SectionHeading({
  title,
  action,
  onPress,
  note,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  note?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-x-3">
      <Text numberOfLines={1} className="shrink font-fraunces text-title text-ink">{title}</Text>
      {action && onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${action} ${title}`}
          activeOpacity={0.7}
          onPress={onPress}
          hitSlop={{ top: 6, bottom: 6 }}
          className="shrink-0 py-1">
          {/* Type, weight and colour are the discovery row's "See all" exactly.
              Two different treatments for the same word, one carrying a chevron
              and one not, made them read as two different kinds of link. */}
          <Text className="font-dm-bold text-meta text-peach">{action}</Text>
        </TouchableOpacity>
      ) : note ? (
        <Text className="shrink-0 pb-0.5 font-dm text-[10.5px] text-taupe">{note}</Text>
      ) : null}
    </View>
  );
}
