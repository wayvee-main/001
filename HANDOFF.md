# Wayvee redesign — handoff

The four-screen onboarding, the Vee-centered home, and the Vee Coral design
system, ported from the approved reference build into the real app and bound to
the live catalog and ranker.

This folder is a complete git repository. `git log` shows the redesign commits on
`redesign-onboarding-home`, on top of the project's full history.

---

## Push it to your own repo

```bash
git remote -v                      # no remote yet, or points somewhere stale
git remote remove origin 2>/dev/null
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin redesign-onboarding-home
```

To make it the default branch instead: `git branch -m redesign-onboarding-home main`
before pushing.

---

## Run it

```bash
npm install
```

### Web (fastest loop)

```bash
npm run web
```

### Android

**Expo Go will not work.** The app uses config plugins with native code
(`expo-secure-store`, `expo-location`, `expo-notifications`, `expo-calendar`,
`@sentry/react-native`), so it needs a development build.

Requirements: Android Studio, an SDK platform, and JDK 17.

```bash
npx expo run:android
```

That runs `prebuild` (generating `android/`) and then Gradle. Start an emulator
in Android Studio first, or plug in a device with USB debugging on. First build
takes a while; later ones are incremental.

If Gradle can't find the SDK, set `ANDROID_HOME` (usually
`~/Library/Android/sdk` on macOS, `%LOCALAPPDATA%\Android\Sdk` on Windows).

`android/` is generated, not committed — `npx expo prebuild --clean` regenerates
it if it ever gets into a bad state.

### iOS (macOS only)

```bash
npx expo run:ios
```

---

## Environment

Copy `.env.example` to `.env`. Without it the app still runs; two things change:

- The Vee composer routes to search instead of the concierge
  (`isSupabaseConfigured` is false).
- Open-now counts, live event listings, weather and Viator picks stay
  unhydrated, so anything derived from them is omitted rather than guessed —
  the counts trail and the weather both disappear. That is deliberate; see
  "Honesty rules" below.

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

---

## Checks

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm test                 # jest — 320 tests, 17 suites
npm run tokens:contrast  # every colour pairing vs WCAG AA, both themes
```

After editing `src/lib/tokens.ts`, run `npm run tokens` to regenerate
`src/global.css`, `src/lib/theme.ts` and `src/lib/tailwind-tokens.generated.js`.
Never hand-edit those three.

---

## What changed, in one screen

| Area | File |
|---|---|
| Palette, type, radius tokens | `src/lib/tokens.ts` (+ `npm run tokens`) |
| Onboarding, 4 steps | `src/components/arrival-sequence.tsx` |
| Onboarding-only ink ramp | `src/lib/wash.ts` |
| Vee mark / wordmark / opening motion | `src/components/vee-mark.tsx`, `wayvee-wordmark.tsx`, `brand-intro.tsx` |
| Home | `src/app/(tabs)/index.tsx` |
| Tab bar (two copies, keep in sync) | `src/app/(tabs)/_layout.tsx`, `src/components/bottom-nav.tsx` |
| Restriction constraints | `src/lib/plan-around.ts` |
| Detail screens (all five) | `src/components/detail-screen.tsx` |
| A shape tile as a plan /plan can render | `src/lib/plan-from-shape.ts` |
| One stop in a night | `src/components/stop-row.tsx` |
| Rows that open in place | `src/components/disclosure-rows.tsx` |
| Which night the app is planning | `currentNightIso` in `src/lib/stay.ts` |
| The live line + fact strip they derive | `src/lib/detail-facts.ts` |
| Icons (Tabler package) | `src/components/glyph.tsx` |

Design rules and the contrast maths live in `DESIGN.md`. The project's working
agreement is in `CLAUDE.md`.

---

## Honesty rules this code follows

Worth knowing before changing anything on Home, because several things that look
like missing UI are deliberate:

- **Nothing renders a number it can't source.** The counts trail only appears
  when every entry means *right now* ("14 kitchens open", "6 shows tonight") —
  it stays hidden rather than degrading to catalog totals, which are inventory,
  not news. Weather has no weaker form either, so it simply doesn't render
  without a forecast. An empty-looking Home usually means unhydrated data, not
  a bug.
- **The ribbon never claims a booking.** It pairs somewhere to eat with
  something to go to. With a held plan it says "Vee is holding" and shows that
  plan's stops; with none it shows the top of each ranking under "Vee's pick for
  tonight". It may name the same restaurant the food section leads with — the
  pairing with a show is what neither list says.
- **The mic is not speech input.** There's no recogniser; it opens the same
  composer, and its accessibility label says so.
- **Every fact has exactly one home.** The detail screens used to say the same
  things repeatedly: the open state was a green row *and* a "Closes" tile *and*
  the About tab's week strip; the walk was a tile *and* a meter; the menu was
  reachable four ways. `DetailScreen` gives each fact one slot — hero, identity,
  live, facts, sections, provenance — so a duplicate has nowhere to go. If you
  are about to add a second place for something the page already says, that is
  the signal to change the first one.
- **A slot with no value renders nothing.** Every slot on `DetailScreen` is
  optional. A nightlife spot has no live state, a collection has no sticky
  actions, Commis has no rating. None of them get a placeholder or a dash.
- **`/plan` only signs the concierge's name to concierge work.** When the model
  call fails, `submitAsk` builds a `plan_evening` request locally and carries
  on, so `askRequest` exists either way and cannot tell you who built the plan.
  `AskPlanSource` can: `'concierge'`, `'local'`, `'shape'`, or null for a plan
  rehydrated from a blob written before the field existed. Null does not claim.
  The double accent border — reserved app-wide for concierge output — follows
  the same flag.
- **Restriction chips only claim what the catalog can enforce.** Dietary needs
  rank up, allergens drop a kitchen outright, and constraints with no verified
  field (wheelchair access, low-noise, limited standing) are carried to Vee as
  context without pretending they filtered anything. See `planAroundEffects`.

---

## Known follow-ups

- The Food interest tile writes the taste tag `"Restaurants"`, which matches
  nothing in any restaurant's haystack (those carry cuisines and search tags,
  never that literal word), so picking Food contributes nothing to food ranking.
  Live music works because it is real event vocabulary. Pre-existing, not
  introduced by the redesign, but it should map onto real catalog vocabulary.
- White on the coral CTA is 3.48:1 — clears AA for large/UI text, misses it for
  body. Kept deliberately as the approved brand button and documented in
  `DESIGN.md`; `npm run tokens:contrast` reports it as a NOTE, not a failure.
- `app.json` still carries `owner: "wayvees-team"` and an `extra.eas.projectId`
  from the original account. Update both before running EAS builds under a new
  account.
- Native timing of the opening motion is unverified — it was checked on web
  only, with no simulator available at the time.
- Older screens still use `text-[Npx]` sizes and hand-rolled shadows; the new
  surfaces use the shared scales. Migrate screen by screen, not in one diff.
  The five detail screens are done — they carried 42 hard-coded sizes across 14
  distinct values and now carry none — and so are `/plan` and `/plan-draft`, but
  the concierge and profile screens have not been through it. `place/[id]`,
  `pick/[id]` and `crawl/[id]` were missed in the original detail audit and are
  still on the old pattern.
- `ActionRow`, `PlaceDetailHero` and `DetailSectionHeader` in
  `src/components/detail.tsx` have no callers and did not have any before the
  detail rework either. They are dead code, left alone to keep that diff to its
  own subject.
- The disclosure rows on the detail screens were only exercised on web. Their
  open/close has no animation and no measured height, so it should be looked at
  on a device before anyone adds one.
- `/plans` lists **pinned items, not plans**, and `askPlan` is ephemeral by
  design — so a built night does not survive navigating away. Pinning is also
  auth-gated (`togglePlan` opens with `requireAuth`, `store.ts`), and plans
  persist to the `user_plans` table rather than to local storage, so a guest
  cannot hold one at all. This is the next thing to decide on the plan surface.
- `/plan-draft`'s control block was a heading, three vibe chips and a
  two-column Pace/Budget grid — 137 pt for three values, above the draft it
  changed. It is now the composer's own pill row: `MetaValue` + `ConstraintRail`
  + `useConstraintPicker`, lifted out of `create.tsx` into
  `src/components/constraint-picker.tsx` so there is one definition rather than
  two copies. 32 pt, and the same three constraints wear the same face on both
  screens of the tab. The screen's 17 hard-coded type sizes went with it — it
  now carries none, and its two hand-drawn section headings are `SectionHeading`.
- `vibes` on `/plan-draft` is still local `useState` that forgets on unmount,
  while `create.tsx` derives the same three literals from `tasteTags`. Seeding
  from `tasteTags` is one line, but it changes what the draft ranks by for
  anyone with taste tags — a behaviour decision, not a layout one.
- `src/components/plan-actions.tsx` is **live**, despite an earlier note here
  saying otherwise: `PlanChip` has five call sites (`discover.tsx`,
  `poster-card.tsx`) and `PlanCta` one (`crawl/[id].tsx`). The claim came from a
  grep that excluded the defining file with `grep -v components/plan-actions`,
  which also swallowed every importer, since they all import from that path.
  Its name still sits confusingly close to `plan-footer.tsx`.
- A dead-export sweep removed **1 file and 23 exports**, plus the second-order
  imports and helpers they were the last users of: `pulse.tsx` entirely;
  `ActionRow`, `PlaceDetailHero`, `DetailSectionHeader`, `DetailAction`,
  `DetailBadge` from `detail.tsx`; `MutedLabel`, `WalkMarker` from `ui.tsx`;
  `RaisedPressable`; `CueRibbon`, `StayAnchorCard`, `RibbonItem` from
  `home-top.tsx`; `PacePickerSheet` and `BudgetPickerSheet` with the `'pace'`
  and `'budget'` members of `SheetKind`; `favoritesFor`, `relatedRestaurants`,
  `searchMenuItems` from `data.ts`; `sortByDistance`, `daypartFocusLine`,
  `getPlace`, `clearRecentAsks`, `tasteVocabularyByCategory`,
  `loadConciergeSignals`, `contentSettled`; and `RAIN_DEMOTION_THRESHOLD`.
  **`npm run lint` is at zero warnings.**
- Nine exports are deliberately kept unused and should stay: the four wrappers
  in `concierge/tools.ts` (their header names TODO.md and a future tool-calling
  loop), `TablesInsert`/`TablesUpdate` in the Supabase-generated
  `database.types.ts`, `dashPassLink`/`uberOneLink` (promo plumbing beside a
  shipping `promotions.ts`), and `isMonitoringConfigured` (env-gated on a
  Sentry DSN). A dead-export scan that reads only `src/` also false-flags the
  six `tokens.ts` exports, which feed `scripts/gen-tokens.ts`.
- `/plan` and `/plan-draft` ended a night with the same two buttons written out
  twice, and both carried the same bug: `Save dinner` and `Add event` shared a
  `flex-row` with `flex-1` on each, so a dinner-only plan stretched one pale
  pill edge to edge — on `/plan`, directly under an identically-shaped Refine
  ghost. Both now use `PlanFooter` (`src/components/plan-footer.tsx`): one row,
  the leading slot sized to its own label, and the **last** save target filled
  so the row reads "change this / commit to this".
- `/answer`'s header was the bordered summary box that came off `/plan` — a
  double rust border, a tinted tile, an uppercase kicker, and a
  `border-sand/60` divider (`sand` is already a 12% ink; the `/60` modifier does
  not compose against a raw rgba, so it painted a solid dark rule) with an
  empty badge row under it on a declined answer. It is now `HeaderRow` +
  `TrustChip` + `FactStrip`, fed by `src/lib/answer-facts.ts`, which returns
  `[]` when there is nothing to state. That was the **last `border-sand/60` in
  the codebase**.
- The "double accent border reserved for concierge output" convention is gone.
  Its comment named `plan.tsx`'s summary (deleted) and `create.tsx`'s composer
  (which uses a hairline `vee-tint` border instead); after `/answer`, the only
  remaining site is the dead `plan-actions.tsx`.
- `SectionTitle` is retired from `src/components/ui.tsx`. It had one caller,
  `answer.tsx`'s "Why this order", and rendered a `ChevronRight` by default —
  a chevron pointing at nothing. That heading is `SectionHeading` now.
- Home has a third restaurant section under Most explored: **More places
  nearby**, a snapping carousel of `LeadCard`s with the next card peeking and
  dots underneath (`src/components/card-carousel.tsx`, the app's first snapping
  scroller — `HRow` deliberately does not snap). `LeadCard` and `TasteMatch`
  moved out of `(tabs)/index.tsx` into `src/components/lead-card.tsx`, verbatim
  including their three raw type sizes: they draw Home's event hero, and
  sweeping them there would move that card as a side effect.
- That carousel could not reuse `dinnerRanked`. `NEARBY_EATS_IDS` is **four
  ids** and Nearby eats renders all four, so a second rail off the same list
  would draw the same four cards. The pool comes off the wider `RESTAURANTS`
  catalog instead, minus whatever the two rails above already spent
  (`src/lib/nearby-pool.ts`, tested).
- It is titled **"More places nearby"**, not "Open now": several real
  restaurants — `farmhouse`, `cookfarmer`, `itani`, `gogi`, `sinaloa` — carry no
  `hours` string in `data.ts`, and the synced `places` table is the only thing
  that fills the gap. `rankNearby` puts open first and unknown ahead of closed,
  and `openBadgeLabel` returns null for unknown so those cards get **no badge**
  rather than a hedged one. On a cold or offline launch that means several
  badge-less cards — visible in the current screenshots, where the sync is
  unreachable.
- The carousel tracks its index on `onScroll`, not only `onMomentumScrollEnd`.
  A drag that stops without flinging, a programmatic scroll and keyboard paging
  all move the rail with no momentum, and the dots desynced in exactly that case
  during testing.
- **`Trending with guests` on Discover (`discover.tsx:349`) is not trending**:
  its data is `currentEvents.slice(0, 2)`, the first two events in catalog
  order. There is no observed-popularity feed in the app — `visual-depictions.tsx`
  says so, and `saved_places`/`user_plans` are queried `.eq('user_id', …)`
  everywhere. `concierge_signals` already records every accepted pick with a
  `ref_id`, so a real count is reachable, but the table is insert-only from the
  app and would need an aggregate view or RPC. Until then that heading is a
  claim the data does not support, and the same word was deliberately kept off
  the new Home section for the same reason.
- `/answer`'s ranked result list was eight separate raised cards in a
  `gap-y-2.5` stack — 94 pt rows on a **104 pt pitch**, against 65-85 at zero
  gap for every other vertical list in the app (food hub 85, `/tonight` 85,
  collection picks 83, venue what's-on 68, `/plan-draft` pickers 65). Its 64 pt
  thumbnail set every row on its own (the text stack inside is ~56) and was the
  largest in the app; the only other 64 is a collection *cover*. It is now one
  `RaisedView` with hairline dividers, a 56 pt thumb and `py-3` — measured at
  **81 pt pitch**, and eight results fit above the fold where seven did.
  The `#1`-`#8` rank pills went with it: an ordered list states rank by
  position and the top row's tint says which is first, so the pills repeated
  both and indented every name by a different amount. `/answer` now carries
  **zero hard-coded type sizes**.
- A row with a `demotedReason` or `statusLabel` renders a fourth line and grows
  past the 56 pt thumb, so the list is not perfectly uniform once constraints
  are relaxed. That was true of the old cards too — it is not a regression.
- Merging the builder's presentation into `/plan`'s is still open, as is the
  fact that "Pick dinner yourself" is a picker sitting ~400 pt below the slot it
  fills.
- `TRIP_CONTEXT_EFFECTS` prints a concrete promise per trip context and its own
  comment says the ranker has to honour it. Two of them did not. Both are wired
  now: `defaultDinnerMinutes` feeds `computeDinnerTime`'s no-show fallback
  (6:30 visiting, 6:00 work, neutral 7 PM otherwise) through `create.tsx` and
  `plan-draft.tsx`, and `LANDMARK_VENUE_IDS` moves landmark events up for
  `visiting` and down for `live` inside `rankEvents`. `arrival-promises.test.ts`
  now holds the printed copy to the code behind it.
- That test caught a real data bug: `LANDMARK_VENUE_IDS` listed `'omca'`, which
  has no `VENUES` record, and the museum's events carry `venue: 'OMCA campus'`
  with no `venueId` — so it could never have matched. It is out of the list
  until a real venue record exists for it, sourced like every other one.
  Landmark coverage today is Yoshi's (9 events), Fox (6), Paramount (2).
- The concierge path (`concierge/adapter.ts`) does **not** carry trip context,
  so a plan built through Ask still uses the neutral 7 PM fallback and no
  landmark weighting. Threading `tripContext` into `ConciergeContext` is the
  remaining half of this.
- `restaurantMetaLine` is still "cuisine · price · distance" for Home, the food
  hub, collections and the plan launchpad. The restaurant detail screen no
  longer uses it — price moved to the fact strip and distance to the live line —
  and builds its own two-field line instead.
