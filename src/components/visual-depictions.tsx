// Depictions of real values. Every component here takes required data and
// renders nothing without it — a chart with a default is a chart that lies on
// the screens where the data doesn't exist (CLAUDE.md: no invented data).
//
// Deliberately absent: a busy-by-hour chart, a room-layout map, a ticket-tier
// bar and the street-grid walking route. All four appear in the design doc, and
// none of them have a source in this repo yet — there is no observed-popularity
// feed, no seat inventory, and no routing geometry, only straight-line
// distance. They go in when the data does, not before.
//
// Gone on purpose: StatRow and WalkMeter. Both drew a fact a second time —
// the four-cell stat row repeated the open state and the walk that the green
// line above it already carried, and clipped its own values doing it; the walk
// meter drew a bar for a number the same line now states. Their facts live in
// liveLineFor() and FactStrip (src/lib/detail-facts.ts).

import { Text, View } from 'react-native';

import { RaisedView } from '@/components/raised-surface';
import { Icon } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { weekSchedule, weekdayLabel, type HoursInterval } from '@/lib/hours';
import type { AffinityTerm } from '@/lib/taste';

function clockLabel(date: Date): string {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}${date.getHours() < 12 ? 'a' : 'p'}`;
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The daylight left today, drawn to scale. `startsAt`/`endsAt` come from
 * daylightRemaining() in weather.ts, which reads NWS's own isDaytime flag —
 * hour-granular, hence "about". Pass `computedLine` only when the caller has
 * really computed something (e.g. a loop's duration against the light left);
 * there is no default sentence here on purpose. */
export function DaylightBudgetBar({
  now,
  startsAt,
  endsAt,
  minutesLeft,
  computedLine,
}: {
  now: Date;
  startsAt: Date;
  endsAt: Date;
  minutesLeft: number;
  computedLine?: string;
}) {
  const total = endsAt.getTime() - startsAt.getTime();
  if (!(total > 0) || minutesLeft <= 0) return null;

  const elapsed = Math.min(Math.max(now.getTime() - startsAt.getTime(), 0), total);
  const elapsedFraction = elapsed / total;

  return (
    <RaisedView className="rounded-card p-3.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-dm-medium text-meta text-pine">Light left</Text>
        <Text className="font-dm-medium text-meta text-taupe">about {durationLabel(minutesLeft)}</Text>
      </View>

      <View className="my-2.5 h-2.5 w-full flex-row overflow-hidden rounded-full bg-sand">
        <View style={{ flex: elapsedFraction }} className="bg-sand2" />
        <View style={{ flex: 1 - elapsedFraction }} className="bg-pine" />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="font-dm text-micro text-taupe">first light {clockLabel(startsAt)}</Text>
        <Text className="font-dm text-micro text-taupe">now {clockLabel(now)}</Text>
        <Text className="font-dm text-micro text-taupe">last light {clockLabel(endsAt)}</Text>
      </View>

      {computedLine ? (
        <View className="mt-2.5 rounded-control bg-sage px-2.5 py-1.5">
          <Text className="font-dm text-meta text-ink">{computedLine}</Text>
        </View>
      ) : null}
    </RaisedView>
  );
}

/** The trust surface. Every row must be a term the ranker actually produced —
 * profileAffinity() in taste.ts returns exactly this shape. Never hand-build
 * `terms` at a call site: the closing line promises the guest that nothing here
 * was written for the occasion, and that promise is the whole point. */
export function WhyThisTrustSurface({
  title,
  score,
  rankText,
  terms,
}: {
  title: string;
  score: number;
  rankText?: string;
  terms: AffinityTerm[];
}) {
  if (!terms.length) return null;

  return (
    <View className="rounded-card border border-sand bg-night p-4 gap-y-3 shadow-sm">
      <View className="flex-row items-center justify-between gap-x-2">
        <View className="flex-1 flex-row items-center gap-x-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-white/15 border border-white/20">
            <Icon d={ICON_PATHS.sparkles} size={14} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text numberOfLines={1} className="flex-1 font-fraunces text-[17px] text-white">{title}</Text>
        </View>
        <View className="rounded-full bg-pine px-3 py-1 border border-pine/40">
          <Text className="font-dm-bold text-[11px] text-white">Score {score.toFixed(1)}</Text>
        </View>
      </View>
      {rankText ? <Text className="font-dm-medium text-[11.5px] text-white/70">{rankText}</Text> : null}

      <View className="overflow-hidden rounded-card border border-white/15 bg-white/10 px-3 py-1">
        {terms.map((term, index) => (
          <View
            key={`${term.label}:${term.reason}`}
            className={`flex-row items-center justify-between py-2.5 ${index < terms.length - 1 ? 'border-b border-white/10' : ''}`}>
            <View className="flex-1 flex-row items-center gap-x-2 pr-2">
              <View className={`h-2 w-2 rounded-full ${term.isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <Text className="flex-1 font-dm-medium text-[12px] text-white">{term.reason}</Text>
            </View>
            <View className={`rounded-full px-2 py-0.5 ${term.isPositive ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}>
              <Text className={`font-dm-bold text-[10.5px] ${term.isPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
                {term.weight > 0 ? `+${term.weight.toFixed(1)}` : term.weight.toFixed(1)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text className="text-center font-dm text-[10.5px] text-white/60">
        Deterministic affinity score · Zero AI hallucinations
      </Text>
    </View>
  );
}

/** A live, verified state stamped with where it came from — the green row at
 * the top of a detail screen. `note` must name the source, because the whole
 * claim of this row is that the fact is current and checkable. */
export function LiveStatusRow({
  label,
  note,
  tone,
}: {
  label: string;
  note?: string;
  tone: 'open' | 'danger';
}) {
  const open = tone === 'open';
  return (
    <View className={`rounded-card border px-3.5 py-2.5 ${open ? 'border-pine/40 bg-sage' : 'border-danger/40 bg-shell'}`}>
      <View className="flex-row items-center gap-x-2">
        <View className={`h-2 w-2 rounded-full ${open ? 'bg-pine' : 'bg-danger'}`} />
        <Text className={`min-w-0 flex-1 font-dm-bold text-label ${open ? 'text-pine' : 'text-danger'}`}>{label}</Text>
      </View>
      {note ? <Text className="mt-1 font-dm text-micro text-taupe">{note}</Text> : null}
    </View>
  );
}

/** Published set times drawn as a timeline instead of a table. Renders nothing
 * without slots — most listings never publish them, and a plausible-looking
 * doors/support/headline sequence on every show is exactly the invented data
 * this file exists to avoid. */
export function RunOfShowRail({
  slots,
  footnote,
}: {
  slots: { time: string; label: string; headline?: boolean }[];
  footnote?: string;
}) {
  if (!slots.length) return null;
  return (
    <RaisedView className="rounded-card p-4">
      <Text className="mb-3 font-dm-bold text-micro uppercase tracking-wider text-taupe">Run of show</Text>
      {slots.map((slot, index) => {
        const last = index === slots.length - 1;
        return (
          <View key={`${slot.time}:${slot.label}`} className="flex-row items-stretch">
            <Text className="w-[62px] shrink-0 pt-px font-dm-bold text-meta text-ink">{slot.time}</Text>
            <View className="w-4 items-center">
              <View className={`mt-1 rounded-full ${slot.headline ? 'h-2.5 w-2.5 bg-rust' : 'h-2 w-2 bg-sand'}`} />
              {last ? null : <View className="w-px flex-1 bg-sand" />}
            </View>
            <Text
              className={`min-w-0 flex-1 pl-2.5 ${last ? '' : 'pb-3'} font-dm text-meta ${
                slot.headline ? 'text-ink' : 'text-taupe'
              }`}>
              {slot.label}
            </Text>
          </View>
        );
      })}
      {footnote ? <Text className="mt-1 font-dm text-micro text-taupe">{footnote}</Text> : null}
    </RaisedView>
  );
}

const MINUTES_PER_DAY = 1440;

function intervalBlocks(intervals: HoursInterval[]): { top: number; height: number }[] {
  // An interval that runs past midnight is drawn clipped at the day boundary —
  // the remainder belongs to the next column, which its own rule already covers.
  return intervals
    .map((interval) => {
      const start = Math.max(0, Math.min(interval.start, MINUTES_PER_DAY));
      const end = Math.max(start, Math.min(interval.end, MINUTES_PER_DAY));
      return { top: (start / MINUTES_PER_DAY) * 100, height: ((end - start) / MINUTES_PER_DAY) * 100 };
    })
    .filter((block) => block.height > 0);
}

/** The week drawn from the same OSM hours string openStateFor reads — midnight
 * at the top of each column, today in accent. Dark days are visible instantly,
 * which is the point. Renders nothing when the spec isn't machine-readable;
 * callers should keep showing the raw hours line in that case. */
export function WeekHoursStrip({
  spec,
  now = new Date(),
  note,
}: {
  spec: string | null | undefined;
  now?: Date;
  note?: string;
}) {
  const week = weekSchedule(spec);
  if (!week) return null;
  const today = now.getDay();

  return (
    <RaisedView className="rounded-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-dm-bold text-micro uppercase tracking-wider text-taupe">Hours this week</Text>
        <Text className="font-dm text-micro text-taupe">midnight to midnight</Text>
      </View>

      <View className="mt-3 flex-row gap-x-1.5">
        {week.map(({ day, intervals }) => {
          const isToday = day === today;
          const blocks = intervalBlocks(intervals);
          return (
            <View key={day} className="min-w-0 flex-1 items-center">
              <Text className={`font-dm-medium text-micro ${isToday ? 'text-peach' : 'text-taupe'}`}>
                {weekdayLabel(day)}
              </Text>
              <View className="mt-1.5 h-11 w-full overflow-hidden rounded-control bg-sand2">
                {blocks.map((block) => (
                  <View
                    key={`${block.top}:${block.height}`}
                    style={{ position: 'absolute', left: 0, right: 0, top: `${block.top}%`, height: `${block.height}%` }}
                    className={isToday ? 'bg-rust' : 'bg-pine'}
                  />
                ))}
              </View>
              {blocks.length ? null : <Text className="mt-1 font-dm text-micro text-danger">closed</Text>}
            </View>
          );
        })}
      </View>

      {note ? <Text className="mt-3 font-dm text-micro text-taupe">{note}</Text> : null}
    </RaisedView>
  );
}
