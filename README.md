# Wayvee — mobile app

Native iOS, Android, and installable web app for **Wayvee** (food, delivery and nights out in Oakland),
built from the original Oakland discovery prototype.

**Stack:** Expo SDK 57 · React Native 0.86 · Expo Router (file-based routing) ·
NativeWind 4 (Tailwind) · Zustand · react-native-svg · Fraunces + DM Sans.

Content is currently curated for **Downtown Oakland**. Optional device location improves directions, ride
pickup, and distance context; the curated content market remains Oakland until a
live content API replaces `src/lib/data.ts`.

## Run it

```bash
npm install
npm start          # Expo dev server — scan the QR with Expo Go
npm run android    # or launch on an Android emulator
npm run ios        # or an iOS simulator (macOS)
npm run web        # browser preview
npm run build:web  # production PWA/static export
npm run preview:web # serve the production web export
npm run typecheck  # tsc --noEmit
```

## What's inside

| Area | Route | Notes |
| --- | --- | --- |
| Home | `(tabs)/index` | Greeting, search, current plans, active events, nearby food, collections |
| Discover | `(tabs)/discover` | Tonight in Oakland — official listings, after-show options, verified hours, bar crawls, venues |
| Plan | `(tabs)/create` | Working launchpad for food, events, and the account’s synced plan timeline |
| Profile hub | `(tabs)/profile` | Plans-first launcher with saved places, taste, location, ordering preference, and sign out |
| My plans | `/plans` | Current events grouped by date plus accessible past plans |
| Saved places | `/saved` | Account-synced restaurant and venue shortlist |
| Taste profile | `/taste` | Add/remove recommendation preferences and dismiss inferred signals |
| Restaurant | `/restaurant/[id]` | Compact menu-first detail with official order/reserve actions, directions, saved places, and visit facts |
| Collection | `/collection` | Current food and event shortlists with verified source handoffs |
| Event → official tickets | `/event/[id]` | Photo-led event detail with venue, admission/travel facts, lineup, plans, and official ticket/listing handoff |
| Venue | `/venue/[id]` | Photo-led venue detail with directions, verified visit facts, official calendar, address, and linked current listings |
| Bar crawl | `/crawl/[id]` | Numbered walking route |

Global overlays (search, filters, delivery quotes, notifications, ride booking, toasts)
live in `src/components/overlays.tsx` and are driven by the Zustand store
(`src/lib/store.ts`), so any screen can open them..

## Structure

```
src/
  app/            # expo-router routes (file = screen)
  components/     # ui primitives, layout helpers, overlays, pulse animations
  lib/            # data fixtures (Oakland), zustand store, icon paths
  global.css      # tailwind entry (NativeWind)
tailwind.config.js  # Wayvee design tokens (colors, fonts)
```
