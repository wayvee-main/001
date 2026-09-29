// The Ask concierge's result screen (docs/build-book.md Part 4.2). Renders
// exactly the same stop-timeline template create.tsx uses for "Plan my stay"
// — every fact shown is a value solveNight() already computed, never
// generated prose. When confidence isn't 'strong', the honest narrowed/
// fallback state takes over: a visible reason plus a clear path to Browse
// instead (CLAUDE.md #6 — never breaks, never fakes certainty).
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailDisclosureGroup, type DetailDisclosure } from '@/components/disclosure-rows';
import { FactStrip, type HubFact } from '@/components/fact-strip';
import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { addEventAction, PlanFooter, saveDinnerAction } from '@/components/plan-footer';
import { SectionHeading } from '@/components/section-heading';
import { TrustChip } from '@/components/trust-chip';
import { LiveStatusRow } from '@/components/visual-depictions';
import { RaisedView } from '@/components/raised-surface';
import { dinnerAction, StopRow, STOP_NOUN } from '@/components/stop-row';
import { Icon } from '@/components/ui';
import { eventDayGroupLabel, restaurantMetaLine } from '@/lib/data';
import { ICON_PATHS } from '@/lib/icons';
import { ticketLink } from '@/lib/links';
import { saveNightDraft } from '@/lib/itinerary';
import type { StopKind } from '@/lib/plan-engine';
import { currentNightIso } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

const OCCASION_LABEL: Record<string, string> = {
  date_night: 'Date Night',
  casual: 'Casual',
  group: 'Group Outing',
  solo: 'Solo',
};

/** Who built the plan, said plainly. The concierge's name is only on the row
 * the concierge actually produced: when the model call fails, submitAsk solves
 * the night locally and carries on, and a shape tile never asks anything at
 * all. Both are real plans off the same engine — they just aren't concierge
 * output, and the double accent border is reserved app-wide for that. */
const SOURCE_COPY: Record<'concierge' | 'local' | 'shape' | 'unknown', { title: string; sub: string; concierge: boolean }> = {
  concierge: { title: 'AI Concierge Summary', sub: 'Real, open, walkable options', concierge: true },
  local: { title: 'Built on this device', sub: 'Real, open, walkable options', concierge: false },
  shape: { title: 'A ready-made shape', sub: 'Real, open, walkable options', concierge: false },
  unknown: { title: 'Built from the catalog', sub: 'Real, open, walkable options', concierge: false },
};

const CONFIDENCE_COPY: Record<'narrowed' | 'fallback', { title: string; sub: string }> = {
  narrowed: {
    title: 'A narrower plan than usual',
    sub: 'One or more picks come with a caveat below — still real, still checked, just not a perfect match.',
  },
  fallback: {
    title: "Closest we could put together",
    sub: 'Nothing quite fit every constraint, so this is the best real option rather than nothing at all.',
  },
};

export default function PlanScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { askPlan, askRequest, pacePreference, budgetPreference, tasteTags, askPlanSource, isPlanned, isSaved, stay, togglePlan, toggleSaved, showToast, recordAskPlanSignal } = useScoper();

  const openLink = (url: string) => Linking.openURL(url).catch(() => showToast('Could not open that link'));

  /** Refine used to return to the composer with nothing on it — the plan being
   * refined was off the screen while you described a change to it. It now opens
   * the builder, which can swap one stop instead of re-solving the night.
   *
   * The write is awaited because /plan-draft loads its draft once on mount:
   * navigating first would show it the draft that existed before the tap. This
   * is the same shape create.tsx writes when a shape tile is accepted, so both
   * doors leave the builder the same thing to open. */
  const openBuilder = async () => {
    if (!askPlan) return;
    recordAskPlanSignal('refined');
    await saveNightDraft(stay ?? null, currentNightIso(stay ?? null), {
      generated: true,
      restaurantId: askPlan.solved.restaurant?.id ?? null,
      eventId: askPlan.solved.event?.id ?? null,
      nightlifeSpotId: askPlan.solved.nightlifeSpot?.id ?? null,
      lockedRestaurant: false,
      lockedEvent: false,
      lockedNightlife: false,
      source: 'vee',
    });
    router.push('/plan-draft');
  };

  if (!askPlan) {
    return (
      <Screen>
        <ScreenScroll gap={18}>
          <HeaderRow title="Plan" />
          <RaisedView className="items-center gap-y-3 rounded-2xl p-6">
            <View className="h-12 w-12 items-center justify-center rounded-full border border-sand bg-coral-50">
              <Icon d={ICON_PATHS.ticket} size={20} color={colors.rust} strokeWidth={1.9} />
            </View>
            <Text className="text-center font-dm text-body text-taupe">Nothing to show yet — ask Vee for a plan.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/create')}
              className="rounded-full bg-rust px-5 py-3">
              <Text className="font-dm-bold text-label text-white">Ask for a plan</Text>
            </TouchableOpacity>
          </RaisedView>
        </ScreenScroll>
      </Screen>
    );
  }

  const { solved, stopOrder, stopLegs, dinnerTimeLabel, confidence, notes, relaxed } = askPlan;
  const { restaurant, event, nightlifeSpot, reasons } = solved;
  const origin = SOURCE_COPY[askPlanSource ?? 'unknown'];

  // Calculate total walk minutes
  const totalWalkMin = stopLegs.reduce((acc: number, leg: string | null) => {
    if (!leg) return acc;
    const match = leg.match(/(\d+)/);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  const matchedTaste = tasteTags.slice(0, 3).join(' · ');

  // What the live line says when the plan is a strong one: the state of the
  // night, not the name of what built it — that moved into the fold below.
  const liveLabel = [
    'Open, walkable, and checked today',
    totalWalkMin > 0 ? `${totalWalkMin} min of walking` : null,
  ].filter(Boolean).join(' · ');

  const planFacts: HubFact[] = [
    ...(restaurant ? [{ glyph: 'clock', label: `Dinner ${dinnerTimeLabel}` }] : []),
    ...(event ? [{ glyph: 'ticket', label: `Show ${event.time}` }] : []),
    ...(restaurant?.price ? [{ glyph: 'dollar', label: restaurant.price, tone: 'accent' as const }] : []),
  ];

  const stopsNote = [
    stopOrder.length === 1 ? '1 stop' : `${stopOrder.length} stops`,
    restaurant ? `from ${dinnerTimeLabel}` : null,
  ].filter(Boolean).join(' · ');

  // Everything the summary box used to hold, as folds under the night.
  const buildRows: DetailDisclosure[] = [
    {
      key: 'origin',
      glyph: origin.concierge ? 'spark' : 'bolt',
      label: origin.title,
      summary: [
        askRequest?.occasion ? (OCCASION_LABEL[askRequest.occasion] ?? askRequest.occasion) : null,
        pacePreference ? `${pacePreference} pace` : 'Relaxed pace',
        budgetPreference ?? restaurant?.price ?? '$$',
      ].filter(Boolean).join(' · '),
      children: (
        <View className="gap-y-1.5">
          <Text className="font-dm text-label leading-[17px] text-ink">{origin.sub}.</Text>
          {notes.map((note) => (
            <Text key={note} className="font-dm text-meta text-taupe">· {note}</Text>
          ))}
          {relaxed?.length ? (
            <Text className="font-dm-medium text-meta text-peach">Relaxed constraints: {relaxed.join(', ')}</Text>
          ) : null}
        </View>
      ),
    },
    ...(matchedTaste
      ? [{
          key: 'taste',
          glyph: 'heart',
          label: 'Why these picks',
          summary: `${matchedTaste} matched`,
          children: (
            <Text className="font-dm text-label leading-[17px] text-ink">
              Ranked against the taste tags on your profile. Nothing here was written for the occasion.
            </Text>
          ),
        }]
      : []),
  ];

  return (
    <Screen>
      <ScreenScroll gap={18}>
        <HeaderRow
          title="Tonight's plan"
          trailing={
            confidence === 'strong'
              ? <TrustChip label="Strong match" hint="Every constraint you gave was met" />
              : <TrustChip label={confidence === 'narrowed' ? 'Narrowed' : 'Closest fit'} glyph="compass" tone="taupe"
                  hint={CONFIDENCE_COPY[confidence].sub} />
          }
        />

        {/* The summary box that used to sit here carried a title, a subtitle, a
            badge, an occasion chip, a facts line and a divided taste line —
            four strata and a second header under the screen's own. Its two
            jobs are the two the detail screens already have parts for: one
            live line for the state, one strip for the facts. Everything else
            it held is a fold below the night. */}
        <LiveStatusRow
          tone={confidence === 'strong' ? 'open' : 'danger'}
          label={confidence === 'strong' ? liveLabel : CONFIDENCE_COPY[confidence].title}
          // The note names the source of the claim, never repeats the claim.
          // Who built the plan is a separate question, and it has its own row
          // in the fold below.
          note={confidence === 'strong'
            ? 'Hours and listings synced daily from each place’s own site.'
            : CONFIDENCE_COPY[confidence].sub}
        />

        {planFacts.length ? <FactStrip facts={planFacts} /> : null}

        {/* A guest whose plan did not fit needs the way out where the caveat
            is, not four blocks further down. */}
        {confidence === 'strong' ? null : (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={() => router.push('/(tabs)/discover')}
            className="h-11 flex-row items-center justify-center rounded-full border border-sand bg-shell px-4">
            <Text className="font-dm-medium text-label text-ink">Browse Discover instead</Text>
          </TouchableOpacity>
        )}

        {stopOrder.length ? <SectionHeading title="The night" note={stopsNote} /> : null}

        {stopOrder.length === 0 ? (
          <RaisedView className="items-center gap-y-2 rounded-2xl p-6">
            <Text className="text-center font-dm text-body text-taupe">Nothing real matched that request tonight.</Text>
            <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => router.push('/(tabs)/discover')} className="rounded-full bg-rust px-5 py-3">
              <Text className="font-dm-bold text-label text-white">Browse Discover</Text>
            </TouchableOpacity>
          </RaisedView>
        ) : (
          <RaisedView className="overflow-hidden rounded-card px-3.5">
            {stopOrder.map((kind: StopKind, index) => {
              const last = index === stopOrder.length - 1;
              // A leg belongs to the stop it leads *to*: "8 min walk from
              // dinner" is a fact about getting to the show, and reading it on
              // the show's own row is how every other list in the app states a
              // distance. orderedLegs indexes legs by their origin, so this
              // stop's arrival is the previous stop's leg.
              const arriving = index > 0 ? stopLegs[index - 1] : null;
              const legLabel = arriving ? `${arriving} from ${STOP_NOUN[stopOrder[index - 1]]}` : null;
              if (kind === 'event' && event) {
                const reasonLabel = reasons.event.slice(0, 2).join(' · ') || null;
                return (
                  <StopRow
                    key="event"
                    kind="event"
                    time={`${eventDayGroupLabel(event)} · ${event.time}`}
                    title={event.name}
                    subtitle={event.venue}
                    reasonLabel={reasonLabel}
                    actionLabel={event.ticketed && event.ticketUrl ? 'Book' : undefined}
                    onAction={event.ticketed && event.ticketUrl ? () => openLink(ticketLink(event.ticketUrl!)) : undefined}
                    legLabel={legLabel}
                    last={last}
                  />
                );
              }
              if (kind === 'dinner' && restaurant) {
                const reasonLabel = reasons.restaurant.slice(0, 2).join(' · ') || null;
                return (
                  <StopRow
                    key="dinner"
                    kind="dinner"
                    time={`Dinner · ${dinnerTimeLabel}`}
                    title={restaurant.name}
                    subtitle={restaurantMetaLine(restaurant)}
                    reasonLabel={reasonLabel}
                    actionLabel={dinnerAction(restaurant).label}
                    onAction={() => openLink(dinnerAction(restaurant).url)}
                    legLabel={legLabel}
                    last={last}
                  />
                );
              }
              if (kind === 'nightlife' && nightlifeSpot) {
                const reasonLabel = reasons.nightlife.slice(0, 2).join(' · ') || null;
                return (
                  <StopRow
                    key="nightlife"
                    kind="nightlife"
                    time="Nightcap"
                    title={nightlifeSpot.name}
                    subtitle={`${nightlifeSpot.kind} · ${nightlifeSpot.hours}`}
                    reasonLabel={reasonLabel}
                    onPress={() => router.push(`/night/${nightlifeSpot.id}`)}
                    legLabel={legLabel}
                    last={last}
                  />
                );
              }
              return null;
            })}
          </RaisedView>
        )}

        {/* Provenance last, the way every detail screen orders it: the night
            is the answer, how it was built is the footnote. */}
        {stopOrder.length ? <SectionHeading title="How this was built" /> : null}
        <DetailDisclosureGroup rows={buildRows} />

        {/* One row, weighted. Refine keeps its own label's width; the save
            targets share what is left and the last of them is filled, so the
            row reads "change this / commit to this". These were a full-width
            ghost stacked on a flex-1 pair — which stretched a single pale
            "Save dinner" edge to edge under an identically-shaped button. */}
        <PlanFooter
          leading={{ label: 'Refine', icon: ICON_PATHS.edit, onPress: () => void openBuilder() }}
          actions={[
            restaurant
              ? saveDinnerAction(isSaved('restaurant', restaurant.id), () => {
                  if (!isSaved('restaurant', restaurant.id)) recordAskPlanSignal('accepted', { stopKind: 'dinner', refId: restaurant.id });
                  toggleSaved('restaurant', restaurant.id, restaurant.name);
                })
              : null,
            event
              ? addEventAction(isPlanned('event', event.id), () => {
                  if (!isPlanned('event', event.id)) recordAskPlanSignal('accepted', { stopKind: 'event', refId: event.id });
                  togglePlan('event', event.id, event.name);
                })
              : null,
          ].filter((action) => action !== null)}
        />
      </ScreenScroll>
    </Screen>
  );
}
