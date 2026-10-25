import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArmchair,
  IconBuildingMonument,
  IconLogout,
  IconBarbell,
  IconBell,
  IconBook,
  IconBookmark,
  IconBolt,
  IconBriefcase,
  IconCalendar,
  IconCar,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconClock,
  IconCompass,
  IconCoffee,
  IconCurrencyDollar,
  IconDots,
  IconGlassCocktail,
  IconHeart,
  IconHome,
  IconLuggage,
  IconMapPin,
  IconMountain,
  IconMovie,
  IconMusic,
  IconMinus,
  IconNavigation,
  IconPhone,
  IconMicrophone,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconSun,
  IconTicket,
  IconToolsKitchen2,
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
  arrowUp: IconArrowUp,
  seat: IconArmchair,
  landmark: IconBuildingMonument,
  logout: IconLogout,
  back: IconArrowLeft,
  bell: IconBell,
  book: IconBook,
  bookmark: IconBookmark,
  bolt: IconBolt,
  briefcase: IconBriefcase,
  calendar: IconCalendar,
  car: IconCar,
  check: IconCheck,
  chevron: IconChevronRight,
  chevronLeft: IconChevronLeft,
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
  home: IconHome,
  luggage: IconLuggage,
  more: IconDots,
  music: IconMusic,
  minus: IconMinus,
  navigation: IconNavigation,
  phone: IconPhone,
  mic: IconMicrophone,
  plus: IconPlus,
  pin: IconMapPin,
  refresh: IconRefresh,
  route: IconRoute,
  search: IconSearch,
  shield: IconShieldCheck,
  spark: IconSparkles,
  sun: IconSun,
  ticket: IconTicket,
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
