// A carousel that snaps, with the next card showing at its edge.
//
// HRow is the app's other horizontal scroller and deliberately does not snap:
// it carries chips and posters where free scrolling is right and no position
// matters. This one holds full-width cards a guest steps through one at a time,
// so it snaps to each and says where it is.
//
// The peek is the point. A card narrower than the screen leaves the next one's
// edge visible, which is a stronger "there is more this way" than any symbol —
// the dots underneath say how far along, the peek says what is next.

import { useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { useThemeColors } from '@/lib/theme';

/** Screen gutter, matching ScreenScroll's. */
const GUTTER = 20;
/** How much of the next card stays visible. */
const PEEK = 44;
const GAP = 10;

export function CardCarousel<T>({
  items,
  renderItem,
  keyExtractor,
}: {
  items: readonly T[];
  /** Given the measured card width, so a card can size its own contents to the
   * peek rather than assuming the full screen. */
  renderItem: (item: T, index: number, width: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
}) {
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  // Derived from the viewport rather than fixed, so the peek is the same on a
  // small phone and a tablet instead of a hard-coded card width that stops
  // peeking on one and swamps the other.
  const cardWidth = Math.max(200, screenWidth - GUTTER * 2 - PEEK);
  const stride = cardWidth + GAP;
  const showDots = items.length > 1;

  const track = (offsetX: number) => {
    const next = Math.min(Math.max(Math.round(offsetX / stride), 0), items.length - 1);
    setIndex((current) => (current === next ? current : next));
  };

  return (
    <View>
      <View style={{ marginHorizontal: -GUTTER }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={stride}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP }}
          // Tracked on scroll rather than only on momentum end: a drag that
          // stops without flinging, a programmatic scroll, and keyboard paging
          // all move the rail without ever producing momentum, and an indicator
          // that misses those is worse than no indicator. Momentum end stays as
          // the settle, so the final snapped card is always the one recorded.
          scrollEventThrottle={32}
          onScroll={(event) => track(event.nativeEvent.contentOffset.x)}
          onMomentumScrollEnd={(event) => track(event.nativeEvent.contentOffset.x)}>
          {items.map((item, position) => (
            <View key={keyExtractor(item, position)} style={{ width: cardWidth }}>
              {renderItem(item, position, cardWidth)}
            </View>
          ))}
        </ScrollView>
      </View>

      {showDots ? (
        // Decorative: a screen reader moves card to card and each one already
        // announces itself, so a second running commentary on position is
        // noise. The count it conveys is visual only.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="mt-2.5 flex-row items-center justify-center gap-x-1.5">
          {items.map((item, position) => {
            const active = position === index;
            return (
              <View
                key={keyExtractor(item, position)}
                // Swapped, not animated. A growing dot would need an Animated
                // value per item for a purely decorative 12 pt of width, and the
                // CSS transition that would do it on web is silently inert on
                // native — one behaviour on two platforms beats a hidden split.
                style={{
                  width: active ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: active ? colors.accent : colors.edge,
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
