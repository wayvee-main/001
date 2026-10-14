import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui';
import { Glyph } from '@/components/glyph';
import { useThemeColors } from '@/lib/theme';

const EDGE_FADE_WIDTH = 28;

/** Flat Nightfall paper/plum ground shared by screens, details and onboarding. */
export function AppBackdrop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

/** The approved extra 14px on each side, including narrow phones. */
export function useAppGutter(): number {
  const { width } = useWindowDimensions();
  return width <= 400 ? 30 : 34;
}

/** Full-height app background with safe-area top padding. */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <AppBackdrop style={{ paddingTop: insets.top + 8 }}>
      {children}
    </AppBackdrop>
  );
}

/** Standard scrolling body: approved 30/34px gutters, spaced sections. Pass refreshing/onRefresh to enable pull-to-refresh. */
/** Height of the tab bar above the safe-area inset, so a tab screen's last
 * element can be scrolled clear of it: 9pt of top padding, the 5pt active dot,
 * a 21pt glyph, a 15pt label, the 3pt gaps between them and 2pt under the label
 * (see (tabs)/_layout.tsx). A screen that ends on a real control has to clear
 * all of it, plus the bar's own bottom pad, or the control is unreachable. */
const TAB_BAR_SPACE = 64;
/** The floor (tabs)/_layout.tsx puts under the bar's bottom padding. */
const TAB_BAR_MIN_BOTTOM = 18;

export function ScreenScroll({
  children,
  gap = 16,
  refreshing,
  onRefresh,
  keyboardShouldPersistTaps,
  keyboardDismissMode,
  automaticallyAdjustKeyboardInsets,
  centerWhenShort = false,
  clearsTabBar = false,
}: {
  children: ReactNode;
  gap?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  automaticallyAdjustKeyboardInsets?: boolean;
  /** Centres a short screen's content in the viewport and lets a long one
   * scroll from the top, which is what a prompt-first screen wants: empty on
   * arrival, ordinary once it has something to show. */
  centerWhenShort?: boolean;
  /** Set on tab screens. Off by default so pushed routes, which have no tab
   * bar over them, don't gain a band of dead space at the bottom. */
  clearsTabBar?: boolean;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const gutter = useAppGutter();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.rust} /> : undefined
      }
      contentContainerStyle={{
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        paddingHorizontal: gutter,
        paddingBottom: clearsTabBar ? 24 + TAB_BAR_SPACE + insets.bottom + TAB_BAR_MIN_BOTTOM : 24,
        gap,
        ...(centerWhenShort ? { flexGrow: 1, justifyContent: 'center' as const } : null),
      }}>
      {children}
    </ScrollView>
  );
}

/** Back button + Fraunces title row for pushed screens. An optional glyph sits
 * with the title rather than replacing the back button — it says what kind of
 * screen this is, which a title composed from a guest's own words no longer
 * does on its own. */
export function HeaderRow({
  title,
  glyph,
  subtitle,
  trailing,
}: {
  title?: string;
  glyph?: string;
  /** A second line under the title, for a screen whose title cannot say which
   * door you came in through. A node rather than a string because the plan
   * builder's says "Vee's pick" as a badge, not as words. */
  subtitle?: ReactNode;
  /** Sits at the far right of the row — a claim or status that belongs with the
   * title but should not be read as part of it. */
  trailing?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-x-3">
      <BackButton />
      {title ? (
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-x-2">
            {glyph ? <Glyph name={glyph} size={17} color={colors.rust} strokeWidth={1.8} /> : null}
            <Text numberOfLines={1} ellipsizeMode="tail" className="shrink font-fraunces text-[19px] text-ink">{title}</Text>
          </View>
          {subtitle ?? null}
        </View>
      ) : null}
      {trailing ? <View className="shrink-0">{trailing}</View> : null}
    </View>
  );
}

/** Horizontal carousel that bleeds to the screen edges (gutter-to-gutter). Fades
 * the trailing edge into the background so a partially-scrolled card reads as
 * "more to scroll" rather than a hard, clipped-off cut. */
export function HRow({ children, gap = 8, bleed = true }: { children: ReactNode; gap?: number; bleed?: boolean }) {
  const colors = useThemeColors();
  const gutter = useAppGutter();
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  // The fade means "there's more this way". A row that fits has no more, and
  // painting it anyway leaves a pale block over the page background — visible
  // as soon as a caller renders a short row, which the food hub's
  // result-derived category chips now do.
  const overflows = viewport > 0 && content > viewport + 1;
  return (
    <View style={{ marginHorizontal: bleed ? -gutter : 0, marginVertical: -6 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        contentContainerStyle={{ paddingHorizontal: bleed ? gutter : 0, paddingVertical: 6, gap }}>
        {children}
      </ScrollView>
      {overflows ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${colors.cream}00`, colors.cream]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: EDGE_FADE_WIDTH }}
        />
      ) : null}
    </View>
  );
}
