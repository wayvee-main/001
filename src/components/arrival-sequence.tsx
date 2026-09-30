import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VeeMark } from '@/components/vee-mark';
import { WayveeWordmark } from '@/components/wayvee-wordmark';
import { Glyph } from '@/components/glyph';
import { AppBackdrop } from '@/components/layout';
import { TRIP_CONTEXTS, TRIP_CONTEXT_EFFECTS, type TripContext, type WalkBudget } from '@/lib/arrival';
import { useActiveCityName } from '@/lib/city';
import {
  NO_RESTRICTIONS,
  OTHER_RESTRICTION,
  PLAN_AROUND_NOTE_MAX,
  planAroundSummary,
  togglePlanAroundChip,
} from '@/lib/plan-around';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useWashInk } from '@/lib/wash';

const STEPS = ['welcome', 'context', 'interests', 'confirm'] as const;
type Step = (typeof STEPS)[number];

/** The six interest tiles. `tags` is what the tile actually writes into the
 * taste profile — the ranker only ever sees vocabulary the catalog carries, so
 * a tile can never promise a category the catalog can't answer.
 *
 * Outdoors and Fitness are no longer dimmed. The previous build greyed them out
 * because no catalog backs them yet, but this step's own copy is now explicit
 * that these are priorities rather than filters, which is the honest framing the
 * dimming was working around. Picking one steers the mix; it never promises a
 * listing that doesn't exist. */
const INTEREST_TILES: { id: string; label: string; tags: string[]; glyph: string; tone: 'warm' | 'vee' | 'accent' }[] = [
  { id: 'food', label: 'Food', tags: ['Restaurants'], glyph: 'food', tone: 'warm' },
  { id: 'music', label: 'Live music', tags: ['Live music'], glyph: 'music', tone: 'vee' },
  { id: 'outdoors', label: 'Outdoors', tags: ['Outdoor'], glyph: 'hike', tone: 'accent' },
  { id: 'fitness', label: 'Fitness', tags: ['Fitness'], glyph: 'fitness', tone: 'vee' },
  { id: 'drinks', label: 'Drinks', tags: ['Nightlife'], glyph: 'drink', tone: 'accent' },
  { id: 'art', label: 'Art & film', tags: ['Movies'], glyph: 'film', tone: 'warm' },
];

const CONTEXT_GLYPHS: Record<TripContext, string> = {
  visiting: 'luggage',
  work: 'briefcase',
  live: 'home',
};

const WALK_OPTIONS: { value: WalkBudget; label: string }[] = [
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: null, label: 'Any distance' },
];

/** Marigold is the one tone a check mark can't sit on in white — `warm-strong`
 * is the ink that belongs on it. Coral and cobalt both carry white. */
function checkInkFor(tone: 'warm' | 'vee' | 'accent', colors: ReturnType<typeof useThemeColors>): string {
  return tone === 'warm' ? colors['warm-strong'] : '#FFFFFF';
}

function toneHex(tone: 'warm' | 'vee' | 'accent', colors: ReturnType<typeof useThemeColors>): string {
  return tone === 'warm' ? colors.warm : tone === 'vee' ? colors.vee : colors.accent;
}

function toneTint(tone: 'warm' | 'vee' | 'accent', colors: ReturnType<typeof useThemeColors>): string {
  return tone === 'warm' ? colors['warm-tint'] : tone === 'vee' ? colors['vee-tint'] : colors['accent-tint'];
}

export function ArrivalSequence({ onDone }: { onDone: () => void }) {
  const storedTripContext = useScoper((s) => s.tripContext);
  const storedWalkBudget = useScoper((s) => s.walkBudgetMinutes);
  const storedPlanAround = useScoper((s) => s.planAround);
  const setTasteTags = useScoper((s) => s.setTasteTags);
  const setTripContextValue = useScoper((s) => s.setTripContext);
  const setWalkBudgetMinutes = useScoper((s) => s.setWalkBudgetMinutes);
  const setPlanAround = useScoper((s) => s.setPlanAround);
  const resolveTastePrompt = useScoper((s) => s.resolveTastePrompt);

  // Seeded from whatever is already stored, so a guest who quit halfway through
  // and came back sees their own answers rather than the defaults again.
  const [step, setStep] = useState<Step>('welcome');
  const [tripContext, setTripContext] = useState<TripContext>(storedTripContext ?? 'visiting');
  const [interests, setInterests] = useState<string[]>(['food', 'music', 'outdoors']);
  const [chips, setChips] = useState<string[]>(storedPlanAround.chips);
  const [note, setNote] = useState(storedPlanAround.note);
  const [walkBudget, setWalkBudget] = useState<WalkBudget>(storedWalkBudget ?? 20);

  const page = STEPS.indexOf(step) + 1;
  const goNext = () => setStep(STEPS[Math.min(page, STEPS.length - 1)]);
  const goBack = () => setStep(STEPS[Math.max(0, page - 2)]);

  // Every answer is written through as it's made, so a guest who closes the app
  // mid-sequence keeps what they already told us.
  const chooseTripContext = (context: TripContext) => {
    setTripContext(context);
    setTripContextValue(context);
  };

  const toggleInterest = (id: string) => {
    const next = interests.includes(id) ? interests.filter((value) => value !== id) : [...interests, id];
    setInterests(next);
    setTasteTags(INTEREST_TILES.filter((tile) => next.includes(tile.id)).flatMap((tile) => tile.tags));
  };

  const leaveInterests = () => {
    void resolveTastePrompt(interests.length > 0 ? 'done' : 'skipped');
    goNext();
  };

  const toggleChip = (chip: string) => {
    const next = togglePlanAroundChip(chips, chip);
    setChips(next);
    // Clearing "Other" drops the note with it — a note nobody can see any more
    // must not keep steering the ranking.
    const nextNote = next.includes(OTHER_RESTRICTION) ? note : '';
    if (!next.includes(OTHER_RESTRICTION) && note) setNote('');
    setPlanAround({ chips: next, note: nextNote });
  };

  const changeNote = (value: string) => {
    setNote(value);
    setPlanAround({ chips, note: value });
  };

  const chooseWalkBudget = (minutes: WalkBudget) => {
    setWalkBudget(minutes);
    setWalkBudgetMinutes(minutes);
  };

  const interestSummary = INTEREST_TILES
    .filter((tile) => interests.includes(tile.id))
    .map((tile) => tile.label)
    .join(' · ') || 'Surprise me';

  /** Writes through everything the confirmation card just showed, tapped or not.
   *
   * The per-answer writes above only fire when a guest actually touches a
   * control, so a guest who accepts the pre-selected defaults — Visiting, the
   * three lead interests, a 20 minute walk — would land on Home with none of it
   * stored, having just read a card that said Wayvee had it. The last screen's
   * promise is what has to be true, so completion commits the whole thing. */
  const commit = () => {
    setTripContextValue(tripContext);
    setWalkBudgetMinutes(walkBudget);
    setTasteTags(INTEREST_TILES.filter((tile) => interests.includes(tile.id)).flatMap((tile) => tile.tags));
    setPlanAround({ chips, note: chips.includes(OTHER_RESTRICTION) ? note : '' });
    void resolveTastePrompt(interests.length > 0 ? 'done' : 'skipped');
    onDone();
  };

  return (
    <Backdrop>
      <Chrome page={page} canGoBack={page > 1} onBack={goBack} />

      {step === 'welcome' ? <WelcomeStep /> : null}
      {step === 'context' ? <ContextStep selected={tripContext} onSelect={chooseTripContext} /> : null}
      {step === 'interests' ? <InterestsStep selected={interests} onToggle={toggleInterest} /> : null}
      {step === 'confirm' ? (
        <ConfirmStep
          chips={chips}
          note={note}
          walkBudget={walkBudget}
          contextLabel={TRIP_CONTEXT_EFFECTS[tripContext].label}
          interestSummary={interestSummary}
          onToggleChip={toggleChip}
          onChangeNote={changeNote}
          onWalkBudget={chooseWalkBudget}
        />
      ) : null}

      {step === 'welcome' ? <SingleFooter label="Get started" onPress={goNext} /> : null}
      {step === 'context' ? (
        <SingleFooter label="Continue" onPress={goNext} />
      ) : null}
      {step === 'interests' ? (
        <SplitFooter
          secondary="Surprise me"
          primary="Continue"
          onSecondary={leaveInterests}
          onPrimary={leaveInterests}
          note={`${interests.length} selected`}
        />
      ) : null}
      {step === 'confirm' ? (
        <SplitFooter secondary="Edit" primary="Open Wayvee" onSecondary={() => setStep('context')} onPrimary={commit} vee />
      ) : null}
    </Backdrop>
  );
}

// ── Shared chrome ───────────────────────────────────────────────────────────

/** The same warm-paper/plum ground as Plans and every other route. Onboarding
 * keeps its warmer ink ramp, but no longer changes background worlds during
 * the handoff into the app. */
function Backdrop({ children }: { children: ReactNode }) {
  return <AppBackdrop>{children}</AppBackdrop>;
}

function Chrome({ page, canGoBack, onBack }: { page: number; canGoBack: boolean; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const ink = useWashInk();
  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="flex-row items-center justify-between px-5 pb-2">
      {canGoBack ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.7}
          hitSlop={10}
          onPress={onBack}
          className="h-8 w-8 items-center justify-center">
          <Glyph name="back" size={18} color={ink.chrome} strokeWidth={1.5} />
        </TouchableOpacity>
      ) : (
        <View className="h-8 w-8" />
      )}

      <View className="flex-row items-center gap-x-2.5">
        <View className="flex-row items-center gap-x-1.5">
          {STEPS.map((item, index) => (
            <View
              key={item}
              style={{
                width: index + 1 === page ? 26 : 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: index + 1 === page ? '#E85D2C' : ink.rail,
              }}
            />
          ))}
        </View>
        <Text style={{ color: ink.step }} className="font-dm-medium text-label tabular-nums">
          0{page}
        </Text>
      </View>

      <View className="h-8 w-8" />
    </View>
  );
}

/** Scrolls rather than sitting in a fixed frame: the reference laid every step
 * out inside an absolutely-positioned 392×843 canvas, which only holds on the
 * one device it was drawn for and breaks the moment the OS text size moves. */
function Page({
  helper,
  title,
  copy,
  branded = false,
  children,
}: {
  helper?: string;
  title: string;
  copy?: string;
  branded?: boolean;
  children?: ReactNode;
}) {
  const ink = useWashInk();
  const colors = useThemeColors();
  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 14, paddingBottom: 28 }}>
      <View className="flex-row items-center gap-x-2.5">
        {branded ? (
          <WayveeWordmark size={32} color={colors.fg} />
        ) : (
          <VeeMark size={22} gradient />
        )}
        {helper ? <Text style={{ color: ink.helper }} className="font-dm text-body">{helper}</Text> : null}
      </View>

      {/* The one deliberately off-scale size in the app: the sequence's hero is
          the first thing anyone sees and the reference sets it at 31/36. Every
          other size on these screens comes from the shared type scale. */}
      <Text
        style={{ color: ink.title, fontSize: 31, lineHeight: 36, letterSpacing: -1.05, marginTop: branded ? 28 : 16 }}
        className="max-w-[330px] font-fraunces-medium">
        {title}
      </Text>
      {copy ? (
        <Text style={{ color: ink.copy }} className="mt-4 max-w-[330px] font-dm text-body">
          {copy}
        </Text>
      ) : null}

      {children}
    </ScrollView>
  );
}

function SingleFooter({ label, onPress }: { label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingBottom: insets.bottom + 16 }} className="px-5 pt-2">
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.86}
        onPress={onPress}
        className="h-[58px] flex-row items-center justify-between rounded-full bg-ember px-5">
        <VeeMark size={19} variant="compact" color="#FFFFFF" />
        <Text className="font-dm-bold text-body-strong text-on-accent">{label}</Text>
        <Glyph name="arrow" size={17} color="#FFFFFF" strokeWidth={1.7} />
      </TouchableOpacity>
    </View>
  );
}

function SplitFooter({
  secondary,
  primary,
  note,
  onSecondary,
  onPrimary,
  vee = false,
}: {
  secondary: string;
  primary: string;
  note?: string;
  onSecondary: () => void;
  onPrimary: () => void;
  vee?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const ink = useWashInk();
  return (
    <View style={{ paddingBottom: insets.bottom + 16 }} className="px-5 pt-2">
      <View className="flex-row gap-x-3">
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.82}
          onPress={onSecondary}
          style={{ backgroundColor: ink.secondaryBg }}
          className="h-[58px] flex-1 items-center justify-center rounded-full">
          <Text style={{ color: ink.secondaryText }} className="font-dm-medium text-body-strong">{secondary}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          onPress={onPrimary}
          className="h-[58px] flex-1 flex-row items-center justify-center gap-x-2 rounded-full bg-ember px-4">
          {vee ? <VeeMark size={18} variant="compact" color="#FFFFFF" /> : null}
          <Text className="font-dm-bold text-body-strong text-on-accent">{primary}</Text>
          {vee ? null : <Glyph name="arrow" size={16} color="#FFFFFF" strokeWidth={1.7} />}
        </TouchableOpacity>
      </View>
      {note ? (
        <Text style={{ color: ink.note }} className="mt-3 text-center font-dm text-meta underline">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function MiniGlyph({ name, tone, size = 40 }: { name: string; tone: 'warm' | 'vee' | 'accent'; size?: number }) {
  const colors = useThemeColors();
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Glyph name={name} size={size * 0.58} color={toneHex(tone, colors)} strokeWidth={1.7} />
    </View>
  );
}

// ── 01 · Welcome ────────────────────────────────────────────────────────────

function WelcomeStep() {
  const ink = useWashInk();
  // The catalog's city, not the device's: this line promises knowledge of a
  // place, and the place we actually know is the one whose catalog is loaded.
  const cityName = useActiveCityName();
  const promises: { glyph: string; tone: 'warm' | 'vee' | 'accent'; text: string }[] = [
    { glyph: 'pin', tone: 'accent', text: 'Real places, hours, and distances' },
    { glyph: 'spark', tone: 'warm', text: 'One balanced plan, shaped around you' },
    { glyph: 'ticket', tone: 'vee', text: 'You control every booking' },
  ];

  return (
    <Page
      branded
      title={`${cityName}, minus\nthe guesswork.`}
      copy="Food, events, outdoors, and fitness—planned around you.">
      <View
        style={{ backgroundColor: ink.cardBg, borderColor: ink.cardBorder }}
        className="mt-7 rounded-panel border px-4">
        {promises.map((promise, index) => (
          <View
            key={promise.glyph}
            style={index < promises.length - 1 ? { borderBottomWidth: 1, borderBottomColor: ink.cardDivider } : undefined}
            className="min-h-[65px] flex-row items-center gap-x-3 py-3">
            <MiniGlyph name={promise.glyph} tone={promise.tone} size={38} />
            <Text style={{ color: ink.body }} className="flex-1 font-dm text-label">
              {promise.text}
            </Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

// ── 02 · Trip context ───────────────────────────────────────────────────────

function ContextStep({ selected, onSelect }: { selected: TripContext; onSelect: (context: TripContext) => void }) {
  const ink = useWashInk();
  const colors = useThemeColors();

  return (
    <Page
      helper="A little context for Vee."
      title={'What brings you\nto Oakland?'}
      copy="Vee adjusts timing, distance, and recommendations.">
      <View className="mt-6 gap-y-2.5">
        {TRIP_CONTEXTS.map((context) => {
          const option = TRIP_CONTEXT_EFFECTS[context];
          const active = selected === context;
          return (
            <TouchableOpacity
              key={context}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}. ${option.blurb}`}
              activeOpacity={0.82}
              onPress={() => onSelect(context)}
              style={{
                backgroundColor: active ? ink.optionSelectedBg : ink.optionBg,
                borderColor: active ? ink.optionSelectedBorder : ink.cardBorder,
              }}
              className="min-h-[72px] flex-row items-center gap-x-2.5 rounded-panel border px-2.5 py-3">
              <MiniGlyph name={CONTEXT_GLYPHS[context]} tone={context === 'work' ? 'vee' : context === 'live' ? 'warm' : 'accent'} size={45} />
              <View className="min-w-0 flex-1">
                <Text style={{ color: ink.strong }} className="font-dm-bold text-section">{option.label}</Text>
                <Text style={{ color: ink.muted }} className="mt-0.5 font-dm text-meta">{option.blurb}</Text>
              </View>
              <View
                style={
                  active
                    ? { backgroundColor: ink.stateSelectedBg, borderWidth: 1, borderColor: ink.stateSelectedBorder }
                    : undefined
                }
                className="h-[25px] w-[25px] items-center justify-center rounded-full">
                <Glyph
                  name={active ? 'check' : 'arrow'}
                  size={15}
                  color={active ? colors.accent : ink.stateIdle}
                  strokeWidth={active ? 2 : 1.5}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Page>
  );
}

// ── 03 · Interests ──────────────────────────────────────────────────────────

function InterestsStep({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const ink = useWashInk();
  const colors = useThemeColors();

  return (
    <Page
      helper="Pick what matters."
      title={'What do you not\nwant to miss?'}
      copy="Choose a few. Vee keeps your day balanced.">
      <View className="mt-6 flex-row flex-wrap justify-between gap-y-2.5">
        {INTEREST_TILES.map((tile) => {
          const active = selected.includes(tile.id);
          return (
            <TouchableOpacity
              key={tile.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={tile.label}
              activeOpacity={0.82}
              onPress={() => onToggle(tile.id)}
              style={{
                width: '48.5%',
                backgroundColor: active ? (ink.interestSelectedBg ?? toneTint(tile.tone, colors)) : ink.optionBg,
                borderColor: active ? toneHex(tile.tone, colors) : ink.cardBorder,
              }}
              className="min-h-[74px] flex-row items-center gap-x-1.5 rounded-panel border px-2 py-3">
              <MiniGlyph name={tile.glyph} tone={tile.tone} size={40} />
              <Text style={{ color: ink.strong }} className="min-w-0 flex-1 font-dm-medium text-label">
                {tile.label}
              </Text>
              {active ? (
                <View
                  style={{ backgroundColor: toneHex(tile.tone, colors) }}
                  className="h-[19px] w-[19px] items-center justify-center rounded-full">
                  <Glyph name="check" size={11} color={checkInkFor(tile.tone, colors)} strokeWidth={2.2} />
                </View>
              ) : (
                <Text style={{ color: ink.helper }} className="font-dm-medium text-section">+</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Page>
  );
}

// ── 04 · Plan around ────────────────────────────────────────────────────────

function ConfirmStep({
  chips,
  note,
  walkBudget,
  contextLabel,
  interestSummary,
  onToggleChip,
  onChangeNote,
  onWalkBudget,
}: {
  chips: string[];
  note: string;
  walkBudget: WalkBudget;
  contextLabel: string;
  interestSummary: string;
  onToggleChip: (chip: string) => void;
  onChangeNote: (value: string) => void;
  onWalkBudget: (value: WalkBudget) => void;
}) {
  const colors = useThemeColors();
  const ink = useWashInk();
  const [expandedGroup, setExpandedGroup] = useState<'food' | 'comfort' | null>(null);
  const otherSelected = chips.includes(OTHER_RESTRICTION);
  const restrictionSummary = useMemo(() => planAroundSummary({ chips, note }), [chips, note]);
  const walkCardLabel = walkBudget === null ? 'Any distance' : `${walkBudget} min`;
  const preferenceGroups = [
    {
      id: 'food' as const,
      label: 'Food & dietary',
      chips: ['Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Dairy-free', 'Nut allergy', 'No alcohol'],
    },
    {
      id: 'comfort' as const,
      label: 'Access & comfort',
      chips: ['Wheelchair access', 'Low-noise', 'Limited standing'],
    },
  ];

  return (
    <Page helper="One last detail." title={'Anything Vee should\nplan around?'}>
      <Text style={{ color: ink.helper }} className="mb-2.5 mt-5 font-dm-bold text-body">Plan around</Text>
      <View className="flex-row flex-wrap gap-2">
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: chips.includes(NO_RESTRICTIONS) }}
          accessibilityLabel={NO_RESTRICTIONS}
          activeOpacity={0.78}
          onPress={() => {
            setExpandedGroup(null);
            onToggleChip(NO_RESTRICTIONS);
          }}
          style={{
            backgroundColor: chips.includes(NO_RESTRICTIONS) ? ink.chipSelectedBg : ink.chipBg,
            borderColor: chips.includes(NO_RESTRICTIONS) ? ink.chipSelectedBorder : ink.chipBorder,
          }}
          className="min-h-[46px] justify-center rounded-full border px-3.5 py-2.5">
          <Text
            style={{ color: chips.includes(NO_RESTRICTIONS) ? ink.strong : ink.body }}
            className={chips.includes(NO_RESTRICTIONS) ? 'font-dm-medium text-body' : 'font-dm text-body'}>
            {NO_RESTRICTIONS}
          </Text>
        </TouchableOpacity>

        {preferenceGroups.map((group) => {
          const selectedCount = group.chips.filter((chip) => chips.includes(chip)).length;
          const expanded = expandedGroup === group.id;
          return (
            <TouchableOpacity
              key={group.id}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${group.label}${selectedCount ? `, ${selectedCount} selected` : ''}`}
              activeOpacity={0.78}
              onPress={() => setExpandedGroup(expanded ? null : group.id)}
              style={{
                backgroundColor: selectedCount ? ink.chipSelectedBg : ink.chipBg,
                borderColor: selectedCount || expanded ? ink.chipSelectedBorder : ink.chipBorder,
              }}
              className="min-h-[46px] flex-row items-center gap-x-2 rounded-full border px-3.5 py-2.5">
              <Text
                style={{ color: selectedCount ? ink.strong : ink.body }}
                className={selectedCount ? 'font-dm-medium text-body' : 'font-dm text-body'}>
                {group.label}
              </Text>
              <Text style={{ color: ink.helper }} className="font-dm-medium text-body">
                {selectedCount || (expanded ? '−' : '+')}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: otherSelected }}
          accessibilityLabel={OTHER_RESTRICTION}
          activeOpacity={0.78}
          onPress={() => onToggleChip(OTHER_RESTRICTION)}
          style={{
            backgroundColor: otherSelected ? ink.chipSelectedBg : ink.chipBg,
            borderColor: otherSelected ? ink.chipSelectedBorder : ink.chipBorder,
          }}
          className="min-h-[46px] justify-center rounded-full border px-3.5 py-2.5">
          <Text
            style={{ color: otherSelected ? ink.strong : ink.body }}
            className={otherSelected ? 'font-dm-medium text-body' : 'font-dm text-body'}>
            {OTHER_RESTRICTION}
          </Text>
        </TouchableOpacity>
      </View>

      {preferenceGroups.map((group) =>
        expandedGroup === group.id ? (
          <View key={group.id} className="mt-2.5 flex-row flex-wrap gap-2">
            {group.chips.map((chip) => {
              const active = chips.includes(chip);
              return (
                <TouchableOpacity
                  key={chip}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={chip}
                  activeOpacity={0.78}
                  onPress={() => onToggleChip(chip)}
                  style={{
                    backgroundColor: active ? ink.chipSelectedBg : ink.chipBg,
                    borderColor: active ? ink.chipSelectedBorder : ink.chipBorder,
                  }}
                  className="min-h-[44px] justify-center rounded-full border px-3.5 py-2.5">
                  <Text
                    style={{ color: active ? ink.strong : ink.body }}
                    className={active ? 'font-dm-medium text-body' : 'font-dm text-body'}>
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null)
      }

      {otherSelected ? (
        <>
          <View
            style={{ backgroundColor: ink.fieldActiveBg, borderColor: ink.fieldActiveBorder }}
            className="mt-2.5 h-[50px] flex-row items-center gap-x-2 rounded-full border pl-4 pr-3">
            <TextInput
              accessibilityLabel="Other restriction for Vee"
              maxLength={PLAN_AROUND_NOTE_MAX}
              onChangeText={onChangeNote}
              placeholder="Tell Vee in your own words"
              placeholderTextColor={ink.placeholder}
              returnKeyType="done"
              value={note}
              style={{ color: ink.strong }}
              className="h-[50px] flex-1 py-0 font-dm text-body"
            />
            <VeeMark size={20} gradient />
          </View>
          <Text style={{ color: ink.hint }} className="mt-1.5 pl-1 font-dm text-meta">
            Vee uses this to rank. Confirm allergies with venues.
          </Text>
        </>
      ) : null}

      <Text style={{ color: ink.helper }} className="mb-2.5 mt-8 font-dm-bold text-body">Comfortable walk</Text>
      <View className="flex-row gap-x-2">
        {WALK_OPTIONS.map((option) => {
          const active = walkBudget === option.value;
          return (
            <TouchableOpacity
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              activeOpacity={0.78}
              onPress={() => onWalkBudget(option.value)}
              style={{
                backgroundColor: active ? ink.walkSelectedBg : ink.chipBg,
                borderColor: active ? ink.walkSelectedBorder : ink.chipBorder,
              }}
              className="min-h-[48px] flex-1 items-center justify-center rounded-full border px-2 py-2.5">
              <Text
                style={{ color: active ? ink.walkSelectedText : ink.body }}
                className={active ? 'font-dm-medium text-body' : 'font-dm text-body'}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ color: ink.helper }} className="mb-2.5 mt-6 font-dm-bold text-body">Your plan</Text>
      <View
        style={{ backgroundColor: ink.cardBg, borderColor: colors.vee }}
        className="mx-1 rounded-card border px-4 pb-3 pt-2.5">
          <View className="flex-row items-center gap-x-3">
            <VeeMark size={25} gradient />
            <View className="min-w-0 flex-1">
              <View className="flex-row items-baseline gap-x-2">
                <Text style={{ color: ink.strong }} className="font-dm-bold text-section">Vee has it</Text>
              </View>
              <Text numberOfLines={1} style={{ color: ink.muted }} className="mt-1 font-dm text-label">
                {interestSummary}
              </Text>
            </View>
            <View className="h-[56px] w-[56px] items-center justify-center overflow-hidden">
              <RouteThumbnail />
            </View>
          </View>

          <View className="mt-2.5 flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <View className="flex-row items-center gap-x-1.5">
              <Glyph name="luggage" size={14} color={ink.helper} strokeWidth={1.8} />
              <Text style={{ color: ink.strong }} className="font-dm-medium text-meta">{contextLabel}</Text>
            </View>
            <View className="flex-row items-center gap-x-1.5">
              <Glyph name="walk" size={14} color={ink.helper} strokeWidth={1.8} />
              <Text style={{ color: ink.strong }} className="font-dm-medium text-meta">{walkCardLabel}</Text>
            </View>
            <View className="min-w-0 flex-row items-center gap-x-1.5">
              <Glyph name="check" size={14} color={ink.diet} strokeWidth={2} />
              <Text numberOfLines={1} style={{ color: ink.strong }} className="font-dm-medium text-meta">
                {restrictionSummary}
              </Text>
            </View>
          </View>
      </View>

    </Page>
  );
}

/** Abstract street blocks and a dashed route between two real-looking points. */
function RouteThumbnail() {
  const colors = useThemeColors();
  const ink = useWashInk();
  return (
    <View style={{ backgroundColor: colors.bg }} className="h-[55px] w-[55px] overflow-hidden rounded-control">
      <View style={{ backgroundColor: colors['warm-tint'] }} className="absolute left-[5px] top-[6px] h-[19px] w-[28px] rounded-md" />
      <View style={{ backgroundColor: colors['vee-tint'] }} className="absolute bottom-[5px] right-[5px] h-[27px] w-[22px] rounded-md" />
      <View style={{ backgroundColor: colors['accent-tint'] }} className="absolute bottom-[7px] left-[6px] h-[17px] w-[18px] rounded" />
      <View
        style={{ borderColor: ink.strong, transform: [{ rotate: '-18deg' }] }}
        className="absolute left-[17px] top-[28px] h-[17px] w-[31px] border-r border-t border-dashed"
      />
      <View style={{ backgroundColor: colors.accent, borderColor: colors.bg }} className="absolute bottom-[11px] left-[10px] h-[9px] w-[9px] rounded-full border-2" />
      <View style={{ backgroundColor: colors.vee, borderColor: colors.bg }} className="absolute right-[10px] top-[10px] h-[9px] w-[9px] rounded-full border-2" />
    </View>
  );
}
