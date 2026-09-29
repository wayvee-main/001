// Hands a planned event off to the device's real calendar app via its native
// "Add Event" dialog — same pattern as rides/delivery elsewhere in this app:
// open the real system flow and let the user confirm, rather than writing a
// calendar entry silently or pretending it's saved. Uses expo-calendar's
// legacy imperative API (createEventInCalendarAsync) specifically because it
// presents that native dialog; the new class-based API added in this SDK
// requires picking a writable calendar ourselves first, which the dialog
// path doesn't need.
//
// Loaded with a dynamic import, not a static one: expo-calendar resolves its
// native module at import time, which throws synchronously on web and on any
// build where the module isn't linked yet (Expo Go, or a dev client built
// before this plugin was added) — a static import would crash every screen
// that pulls this file into its module graph, not just the moment a guest
// taps "Add to calendar".
import { Platform } from 'react-native';

import type { ScoperEvent } from '@/lib/data';

// The catalog has no explicit event duration — 2 hours is a working default
// for the calendar block, not a claim about the actual show/dinner length.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export type CalendarExportResult = 'saved' | 'cancelled' | 'unsupported' | 'denied' | 'error';

export async function addEventToCalendar(event: ScoperEvent): Promise<CalendarExportResult> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!event.startsAt) return 'error';

  try {
    const Calendar = await import('expo-calendar/legacy');
    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (permission.status !== 'granted') return 'denied';

    const startDate = new Date(event.startsAt);
    if (Number.isNaN(startDate.getTime())) return 'error';
    const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MS);

    const result = await Calendar.createEventInCalendarAsync({
      title: event.name,
      startDate,
      endDate,
      location: event.addr,
      notes: [event.venue, event.know].filter(Boolean).join(' — '),
    });
    // Android always reports 'done' regardless of outcome (see expo-calendar
    // docs) — treated as saved since that's the common case there.
    return result.action === 'saved' || result.action === 'done' ? 'saved' : 'cancelled';
  } catch {
    return 'error';
  }
}
