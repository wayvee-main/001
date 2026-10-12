import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconArrowRight,
  IconBarbell,
  IconBell,
  IconBolt,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconCompass,
  IconCoffee,
  IconCurrencyDollar,
  IconDots,
  IconGlassCocktail,
  IconHeart,
  IconHistory,
  IconHome,
  IconLuggage,
  IconMapPin,
  IconMicrophone,
  IconMountain,
  IconMovie,
  IconMusic,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconShieldCheck,
  IconShare,
  IconSparkles,
  IconSun,
  IconSunset2,
  IconTicket,
  IconToolsKitchen2,
  IconTrendingUp,
  IconUser,
  IconWallet,
  IconWalk,
  IconX,
  type Icon as TablerIcon,
} from '@tabler/icons-react-native';

/**
 * Tabler stays the exclusive glyph source (see the note on `Icon` in ui.tsx) —
 * this is that policy with the real package behind it instead of hand-copied
 * path data, so a glyph can't drift from its source by a transcription slip.
 *
 * `Icon` in ui.tsx is unchanged and still serves every screen built against
 * ICON_PATHS; this is the layer the redesigned surfaces draw from. New glyphs
 * belong here, by name, not as another `d` string somewhere.
 */
const GLYPHS: Record<string, TablerIcon> = {
  arrow: IconArrowRight,
  back: IconArrowLeft,
  bell: IconBell,
  bolt: IconBolt,
  briefcase: IconBriefcase,
  calendar: IconCalendar,
  check: IconCheck,
  chevron: IconChevronRight,
  clock: IconClock,
  close: IconX,
  compass: IconCompass,
  coffee: IconCoffee,
  dollar: IconCurrencyDollar,
  drink: IconGlassCocktail,
  film: IconMovie,
  filter: IconAdjustmentsHorizontal,
  fitness: IconBarbell,
  food: IconToolsKitchen2,
  heart: IconHeart,
  hike: IconMountain,
  history: IconHistory,
  home: IconHome,
  luggage: IconLuggage,
  mic: IconMicrophone,
  more: IconDots,
  music: IconMusic,
  pencil: IconPencil,
  pin: IconMapPin,
  plus: IconPlus,
  refresh: IconRefresh,
  route: IconRoute,
  search: IconSearch,
  shield: IconShieldCheck,
  share: IconShare,
  spark: IconSparkles,
  sun: IconSun,
  sunset: IconSunset2,
  ticket: IconTicket,
  trend: IconTrendingUp,
  user: IconUser,
  wallet: IconWallet,
  walk: IconWalk,
};

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({
  name,
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  name: GlyphName | string;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const Drawn = GLYPHS[name] ?? IconSparkles;
  return <Drawn color={color} size={size} strokeWidth={strokeWidth} />;
}
