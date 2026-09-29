import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { ChevronRight, EmptyState, Icon } from '@/components/ui';
import { addEventToCalendar } from '@/lib/calendar-export';
import { CRAWLS, EVENTS, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES, eventDayGroupLabel, isCurrentEvent } from '@/lib/data';
import { ICON_PATHS } from '@/lib/icons';
import { loadPlanHistory, type PlanHistoryEntry } from '@/lib/plan-history';
import { useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import type { PlanKind } from '@/lib/user-data';
import { useViatorPicks } from '@/lib/viator';

const CALENDAR_ICON = 'M6 3v3 M18 3v3 M4 8h16 M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1 -1z M8 12h3v3H8z';

const PINNED_ICON: Record<Exclude<PlanKind, 'event'>, string> = {
  restaurant: ICON_PATHS.cutlery,
  venue: ICON_PATHS.ticket,
  night: ICON_PATHS.martini,
  crawl: ICON_PATHS.compass,
  pick: ICON_PATHS.sparkles,
};

const PINNED_ROUTE: Record<Exclude<PlanKind, 'event'>, string> = {
  restaurant: '/restaurant',
  venue: '/venue',
  night: '/night',
  crawl: '/crawl',
  pick: '/pick',
};

function GroupedCard({
  icon,
  title,
  sub,
  dark = false,
  onPress,
  onAddToCalendar,
}: {
  icon: string;
  title: string;
  sub: string;
  dark?: boolean;
  onPress: () => void;
  onAddToCalendar?: () => void;
}) {
  const colors = useThemeColors();
  const surface = useRaisedSurface(2);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={dark ? undefined : surface}
      className={`flex-row items-center gap-x-3 rounded-card px-3.5 py-3.5 ${dark ? 'border border-sand bg-coral-50' : ''}`}>
      <Icon d={icon} size={18} color={colors.peach} />
      <View className="flex-1">
        <Text className="font-dm-medium text-[14px] text-ink">{title}</Text>
        <Text className="mt-0.5 font-dm text-label text-taupe">{sub}</Text>
      </View>
      {onAddToCalendar && Platform.OS !== 'web' ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Add ${title} to calendar`}
          activeOpacity={0.7}
          onPress={(event) => {
            event.stopPropagation();
            onAddToCalendar();
          }}
          className="h-9 w-9 items-center justify-center rounded-full bg-shell">
          <Icon d={CALENDAR_ICON} size={15} color={colors.peach} strokeWidth={1.8} />
        </TouchableOpacity>
      ) : null}
      <ChevronRight color={colors.taupe} />
    </TouchableOpacity>
  );
}

/** Resolves a non-event pinned plan key to what's shown on its card — null
 * when the underlying catalog entry no longer exists (deleted/rotated out),
 * so a stale key is silently skipped rather than shown broken. */
function usePinnedNonEventEntries(plans: string[]) {
  const picks = useViatorPicks();
  return useMemo(() => {
    return plans
      .filter((key) => !key.startsWith('event:'))
      .map((key) => {
        const separatorIndex = key.indexOf(':');
        const kind = key.slice(0, separatorIndex) as Exclude<PlanKind, 'event'>;
        const itemId = key.slice(separatorIndex + 1);
        if (kind === 'restaurant') {
          const item = RESTAURANTS[itemId];
          return item ? { key, kind, itemId, title: item.name, sub: item.cuisine } : null;
        }
        if (kind === 'venue') {
          const item = VENUES[itemId];
          return item ? { key, kind, itemId, title: item.name, sub: item.detailMeta } : null;
        }
        if (kind === 'night') {
          const item = NIGHTLIFE_SPOTS.find((spot) => spot.id === itemId);
          return item ? { key, kind, itemId, title: item.name, sub: item.kind } : null;
        }
        if (kind === 'crawl') {
          const item = CRAWLS[itemId];
          return item ? { key, kind, itemId, title: item.name, sub: item.meta } : null;
        }
        if (kind === 'pick') {
          const item = picks.find((p) => p.id === itemId);
          return item ? { key, kind, itemId, title: item.title, sub: item.destination } : null;
        }
        return null;
      })
      .filter((entry): entry is { key: string; kind: Exclude<PlanKind, 'event'>; itemId: string; title: string; sub: string } => entry !== null);
  }, [plans, picks]);
}

export default function PlansScreen() {
  const router = useRouter();
  const { plans, showToast } = useScoper();
  const [planHistory, setPlanHistory] = useState<PlanHistoryEntry[]>([]);

  useEffect(() => {
    loadPlanHistory().then(setPlanHistory);
  }, [plans]);

  // Group planned events by day, derived live from each event's own date string —
  // add anything from Discover and it lands in the right section automatically.
  const eventPlanIds = plans.filter((key) => key.startsWith('event:')).map((key) => key.slice('event:'.length));
  const currentPlans = eventPlanIds.filter((eventId) => {
    const event = EVENTS[eventId];
    return event && isCurrentEvent(event);
  });
  const groups = new Map<string, string[]>();
  for (const eventId of currentPlans) {
    const ev = EVENTS[eventId];
    if (!ev) continue;
    const label = eventDayGroupLabel(ev);
    groups.set(label, [...(groups.get(label) ?? []), eventId]);
  }
  const orderedLabels = ['Tonight', 'Tomorrow', ...[...groups.keys()].filter((l) => l !== 'Tonight' && l !== 'Tomorrow')];

  const pinnedNonEvents = usePinnedNonEventEntries(plans);

  // Past: things that stayed planned until the listing expired. Sourced from
  // the local plan-history snapshot (see lib/plan-history.ts) since expired
  // listings are deleted from the catalog, not archived — a plan whose id
  // predates this feature (no saved snapshot) is honestly omitted rather
  // than shown with guessed details.
  const historyByEventId = new Map(planHistory.filter((entry) => entry.kind === 'event').map((entry) => [entry.itemId, entry]));
  const pastEntries = eventPlanIds
    .filter((eventId) => !currentPlans.includes(eventId))
    .map((eventId) => historyByEventId.get(eventId))
    .filter((entry): entry is PlanHistoryEntry => Boolean(entry))
    .sort((a, b) => (b.startsAt ?? b.plannedAt).localeCompare(a.startsAt ?? a.plannedAt));
  const unsnapshottedPastCount = eventPlanIds.filter((eventId) => !currentPlans.includes(eventId)).length - pastEntries.length;

  const addToCalendar = async (eventId: string, eventName: string) => {
    const event = EVENTS[eventId];
    if (!event) return;
    const result = await addEventToCalendar(event);
    if (result === 'saved') showToast(`${eventName} added to your calendar`);
    else if (result === 'denied') showToast('Calendar access was not enabled');
    else if (result === 'error') showToast('Could not add that to your calendar');
  };

  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title="My plans" />

        {orderedLabels.map((label) => {
          const eventIds = groups.get(label) ?? [];
          if (eventIds.length === 0) return null;
          return (
            <View key={label} style={{ marginTop: 10 }} className="gap-y-2.5">
              <Text className="font-fraunces text-[19px] text-ink">{label}</Text>
              {eventIds.map((id) => {
                const ev = EVENTS[id];
                return (
                  <GroupedCard
                    key={id}
                    icon={ICON_PATHS.ticket}
                    title={ev.name}
                    sub={`${ev.time} · ${ev.priceLabel}`}
                    dark
                    onPress={() => router.push(`/event/${id}`)}
                    onAddToCalendar={() => addToCalendar(id, ev.name)}
                  />
                );
              })}
            </View>
          );
        })}

        {currentPlans.length === 0 && pinnedNonEvents.length === 0 ? (
          <EmptyState
            compact
            title="No upcoming plans yet"
            message={'Browse Discover and tap “Plan” on anything you want to go to.'}
            actionLabel="Browse Discover"
            onAction={() => router.push('/discover')}
          />
        ) : null}

        {pinnedNonEvents.length > 0 ? (
          <View style={{ marginTop: 10 }} className="gap-y-2.5">
            <Text className="font-fraunces text-[19px] text-ink">Pinned for your stay</Text>
            {pinnedNonEvents.map((entry) => (
              <GroupedCard
                key={entry.key}
                icon={PINNED_ICON[entry.kind]}
                title={entry.title}
                sub={entry.sub}
                onPress={() => router.push(`${PINNED_ROUTE[entry.kind]}/${entry.itemId}`)}
              />
            ))}
          </View>
        ) : null}

        {pastEntries.length > 0 ? (
          <View style={{ marginTop: 10 }} className="gap-y-2.5">
            <Text className="font-fraunces text-[19px] text-ink">Past</Text>
            {pastEntries.map((entry) => (
              <GroupedCard
                key={entry.itemId}
                icon={ICON_PATHS.ticket}
                title={entry.name}
                sub={`${entry.date} · ${entry.venue}`}
                onPress={() => router.push(`/event/${entry.itemId}`)}
              />
            ))}
            {unsnapshottedPastCount > 0 ? (
              <Text className="font-dm text-meta text-taupe">
                {unsnapshottedPastCount} older {unsnapshottedPastCount === 1 ? 'plan isn’t' : 'plans aren’t'} shown — their listing details weren&apos;t saved before this device tracked history.
              </Text>
            ) : null}
          </View>
        ) : null}

      </ScreenScroll>
    </Screen>
  );
}
