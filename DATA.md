# Wayvee data: what lives where, and how it gets refreshed

Wayvee ships as a static Expo web export. All catalog data is checked into the
repo and verified by hand against official sources — nothing is scraped at
runtime. This file records the split and the daily workflow.

## The split

| Layer | File | Cadence | Contents |
|---|---|---|---|
| Place identity | `src/lib/data.ts` | Occasional | Restaurants, menus, venues, curated sections, search + filter logic. Changes only when a place opens, closes, or its verified details change. |
| Events (curated) | `src/lib/events.ts` | **Daily** | Every hand-verified listing, each with `startsAt` (ISO, Oakland time), `sourceUrl`, and `verifiedLabel`. This is the only file the daily refresh touches. |
| Events (Ticketmaster) | Supabase `events`, `source='ticketmaster'` | On demand | Pulled by `scripts/sync-ticketmaster.ts`. Backend-only — never in the bundle. |
| Places (bulk) | Supabase `places` | Weekly | Overture Maps + OpenStreetMap, via `scripts/sync-places.ts`. Includes OSM's verbatim `opening_hours`. |
| Weather | Supabase `weather_hourly` | Hourly | National Weather Service forecast for each launched city's anchor, via `scripts/sync-weather.ts`. |
| Sync health | Supabase `sync_runs` (+ `sync_status` view) | Every run | One row per sync run: rows written/pruned, duration, ok/partial/failed. |
| User data | Supabase | Runtime | Saves, follows, plans, taste preferences. Never in the repo. |

## Source-backed detail goods

`places.detail_content` and `events.detail_content` are versioned public JSON
payloads validated by `src/lib/detail-content.ts`. They carry menu items,
associated dish photos, prices as listed, source links, dated offers, artist
photos, venue imagery and complete source notes. The existing public-read and
service-write policies also protect these columns. Invalid payloads are ignored;
unsafe URLs and expired offers never become app controls.

`Populate detail content` applies the additive migration, fills place goods
using `scripts/sync-menu-schema.ts`, publishes current curated events and refreshes Ticketmaster's rich event
payloads before the longer menu crawl. The menu job uses already verified curated menus for matching city,
name and full street addresses, plus published schema.org, Wix and Squarespace
menu/product metadata from the establishment's official site. It follows at
most two published menu links, has bounded concurrency, request time and body
size, and rejects private-network sources. A failed source retains cached
verified content. It reports actual menus, items and photos populated; it does
not invent missing data or promise that every place publishes a readable menu.
Manual run: `npx --yes tsx scripts/sync-menu-schema.ts` with the same service-role
environment as the other sync jobs. No credentials reach the mobile bundle.

Collection uses deterministic extractors, with **no LLM calls or raw-page dumps**.
GitHub Actions persists extracted fields, menu links, body hashes and HTTP
validators in a versioned cache. Successful sources are fresh for seven days;
due sources use ETag/Last-Modified and unchanged bodies are not parsed again.
Unavailable sources retry after 1, 2, 4, then 7 days while retaining prior goods.
City, place ID, street identity and URL scope each cache entry. Parser changes
invalidate the Actions cache. A run allows at most 100 actual HTTP requests,
including redirects and menu subpages (`DETAIL_MENU_FETCH_LIMIT`, maximum 500).
Fresh/failed cached sources free the budget to reach further unpopulated places.
Unchanged backend records are not rewritten. Logs contain one compact coverage,
request/cache and write-count summary per city; inspect individual sources only
to resolve a concrete extraction failure. No source HTML enters model context.

Home and existing detail routes consume the same payload. Map-sourced places
can open Menu Journal as well as curated restaurants. Photos remain associated
with the named dish/venue. Full menu browsing and item details stay in the app;
the official source is still available for ordering and current availability.
Detail focus refreshes the real catalog with a short shared throttle, so a menu
populated after launch reaches an already running app. Screenshots shown for
this implementation come from the app with live data, without substituted
fixture responses or independent mockup copy.

## Why store events in the repo instead of pulling from the web

- **Runtime scraping is brittle**: venue calendars are JS-rendered, CORS-blocked,
  and change markup without notice. A broken fetch would blank the Events surfaces.
- **The deploy cadence is already daily**: pushing `main` rebuilds and deploys in
  ~1 minute, so a daily data commit *is* the refresh pipeline.
- **The audit trail survives**: each entry's `verifiedLabel` records when and where
  it was checked. A runtime feed would lose that.

**Backend population (live)**: the Supabase `events` table
(`supabase/migrations/20260929000000_wayvee_initial.sql`) mirrors `events.ts`.
The publisher validates current entries and filters expired legacy IDs before writing; an old bundled bookmark cannot block valid current content. The full maintenance audit still reports expired bundle entries.
At launch the app overlays backend rows onto the bundled snapshot
(`src/lib/events-remote.ts`) — the bundle is the offline/first-paint fallback,
so a missing or partial table can never blank the app. After editing
`events.ts`, run `npm run sync:events` (needs `SUPABASE_SERVICE_ROLE_KEY`) to
populate the backend immediately, ahead of the next deploy.

## Daily events refresh (the workflow)

1. Check each venue's official calendar (Yoshi's, Fox, Paramount, Eli's, OMCA).
2. In `src/lib/events.ts`:
   - **Delete** past entries — do not archive them in this file.
   - **Advance** recurring series (e.g. Blue Mondays) to their next occurrence.
   - **Add** new listings with `startsAt`, `sourceUrl`, `verifiedLabel`, and a
     real image from the venue's own listing.
3. Run `npm run audit:data` (structure) and `npm run audit:images` (every
   image URL must serve a real image). Both exit non-zero on gaps.
4. Run `npm run sync:events` to populate the backend table right away.
5. Commit and push `main` — Vercel deploys automatically.

## Home tile counts

Each tile shows its real inventory count beside its category name: the nearest
food pool, active-city nightlife/route catalogs, or current event listings.
Home tiles use the restored reference layout: small category glyphs, real
counts at top right, category names and short general captions. No venue preview
metadata or photos are promoted into those four cards. Captions describe the
category, not an unsupported opening status. Counts open the same real pools
through Home's separate Field Guide routes.

## Home intentions and Field Guide

`home-discovery.ts` selects three suggestion themes and collections using the
existing guest-local daypart boundaries. For you names intentions (breakfast,
dinner, trails, shows), not individual places. Collections use current member
records and omit past events and events more than seven days away. Bookmarking an idea or collection does not require it to
remain in the current Home promotion window.

`home-guide.ts` adapts existing native records without changing shared data or
Discover. Its Eat list preserves nearest membership/order and measured versus
estimated labels. Home search, category lists, idea lists, collection lists and
details use `/home/*`; Discover and its existing details remain unchanged.
Curated Oakland food/nightlife/routes never fill another city's catalog.
`home-outdoors.ts` supplies separately city-scoped walking ideas for Oakland and
San Francisco with official destination links. Do not invent difficulty,
opening status, park access or GPS distances. Link current park notices.
Collections and For you share `HomeDoorCard` with an exact 83px height and
58px square photo thumbnails (11px corners), including their See all lists.
For you uses a representative image from its own local results; Collections
use a current member photo or their verified cover, including in Home search.
`home-guide-photos.ts` adds official source photos only to Home's adapters;
it does not alter Discover or shared native records. Missing/failed images
retain a relevant outline-glyph fallback. Home's Vee ribbon and Link your stay
use `surface-ribbon` (`#F7E5E1` light / `#100D13` dark).

## Image policy

Home Field Guide photos belong to the named source record. Known stock-photo
hosts are rejected; missing/failed images use the corresponding outline glyph.
The old bundled Home window assets remain available but are not used for
Around you's category illustrations.

Photos must come from the establishment itself (its site or official listing).
Nearby place photos are supplemented in `src/lib/place-images.ts` using exact
map IDs and venue-owned source pages. Supplied photos take precedence; null
live/cache fields retain verified enrichment. Home and Nearest keep their real
distance order and use a non-photo category glyph when a venue image is absent
or fails to load.

**No generic or stock stand-ins.** A menu item without a native photo renders
the app's neutral striped placeholder until one is sourced; the audit prints
running coverage (`native menu photos: N/M`). The same rule applies to venue,
event, and restaurant hero images.

## Ticketmaster as a second event source

`npm run sync:ticketmaster` (needs `TICKETMASTER_API_KEY` + service role key)
pulls Discovery API listings within 5 miles of the downtown anchor
(12th St / Broadway) for the next 30 days and writes them to the same `events`
table with `source='ticketmaster'`. `TICKETMASTER_DRY_RUN=1` prints the cut
without writing anything — use it before the first real run.

**Why it can't break anything (principle 6):** the client never calls
Ticketmaster. The API key lives only in the sync script's environment. The
bundled snapshot in `events.ts` stays the offline/first-paint fallback, so an
empty or stale `ticketmaster` set just means fewer rows, never a blank screen.

**Each sync script prunes only its own rows.** `source` (added in
`20260929000000_wayvee_initial.sql`) is what makes that possible —
`sync-events.ts` deletes `source='curated'` only, `sync-ticketmaster.ts`
deletes `source='ticketmaster'` only. An unscoped prune in either wipes the
other's rows.

**What the sync drops, and why** (principle 4 — curation stays hand-picked):

| Dropped | Reason |
|---|---|
| `fallback: true` images | Ticketmaster's generic stock art — fails the image policy below |
| Parking, VIP packages, shuttles, upgrades | Upsells and logistics, not things to go do |
| `Miscellaneous` / `Undefined` segment | Where Ticketmaster files non-events |
| Cancelled / postponed / rescheduled | Don't send a guest to a dead show |
| `dateTBA` / `timeTBA` / `noSpecificTime` | "Right now" (principle 3) needs a real clock time |
| Same venue + start within 90 min of a curated entry | Curated wins — it carries a real `verifiedLabel` and editorial copy |
| Beyond 3 per venue / 40 total | A firehose isn't a concierge |

Nothing is invented in the mapped rows: prices come from `priceRanges` (or say
"See tickets"), `know` is Ticketmaster's own `info`/`pleaseNote` (or a plain
pointer to the listing), and `travel` is haversine distance from the anchor to
Ticketmaster's real venue coordinates — not a guessed walk time. `verifiedLabel`
reads "Listed on Ticketmaster — pulled &lt;date&gt;" rather than claiming a
hand-check that didn't happen, and `ticketProvider` is `Ticketmaster`, which the
event detail screen already surfaces as "via Ticketmaster".

Note `npm run audit:data` only validates the bundled catalog, so it does not
cover these rows — the filters in the sync script are their audit.

## Open-now, from real hours only

`public.places.opening_hours` carries OpenStreetMap's `opening_hours` tag
**verbatim** — never normalized, never inferred from a category, null when the
source has none. `src/lib/hours.ts` reads a conservative subset of that syntax
(weekday selectors, multiple daily windows, `off`/`closed`, `24/7`, windows that
cross midnight) and returns `unknown` for everything it can't model exactly:
months, week numbers, sunrise/sunset, nth-weekday rules, comments.

`unknown` renders as *no line at all*, never as "Closed". A guest sent to a
locked door by a confident guess is the failure this rule exists to prevent.
The one documented exception is `PH`/`SH` (holiday) rules, which are skipped
rather than disqualifying an otherwise plain spec — so on a public holiday the
computed state can be wrong. Every surface that shows the state also shows the
underlying hours, so the source is always visible.

## Weather

`npm run sync:weather` pulls the hourly forecast for the downtown anchor
(12th St / Broadway) from the US National Weather Service (`api.weather.gov` —
public domain, no key, and no terms against storing the result) into
`public.weather_hourly`. Rows are NWS forecast periods carried across as
published: no averaging, no derived values, nulls left null.

**Why it can't break anything (principle 6):** the client never calls NWS. If
the sync stops, stored periods age out and `weatherAt()` returns null once none
covers the current hour — the weather simply disappears from Home rather than
showing yesterday's forecast as "right now".

`useWeatherNow` ticks each minute and refreshes on app foreground, browser
focus/visibility and city changes. The backend read is shared across concurrent
callers and throttled to 15 minutes while a current period exists; a missing
current hour retries immediately. Cache keys and late-response checks keep
cities isolated. Current valid cache periods work offline; stale periods never
become a guessed temperature.

## Sync observability

Every sync script wraps its run in `withSyncRun()` (`scripts/lib/sync-run.ts`),
which writes one row to `public.sync_runs`: job, `ok`/`partial`/`failed`, rows
written, rows pruned, duration, and a short detail string. `partial` means the
run wrote real rows but knowingly fell short — one of two sources was down, a
prune warned — so a degraded run reads differently from a clean one.

```
npm run backend:health
```

reads the `sync_status` view (latest run per job) and exits non-zero when a job
last failed or is older than its cadence allows. It uses the publishable key,
not the service role — checking on the pipeline never requires a secret.

Before this existed, a scheduled sync that silently 401'd for a week looked
exactly like a quiet week in Oakland. Freshness is now recorded, not assumed.

## Scheduled syncs

| Workflow | Cadence | Writes |
|---|---|---|
| `sync-events.yml` | Daily 08:23 UTC + on push to `src/lib/events.ts` | `events` (`curated`) |
| `sync-ticketmaster.yml` | Daily 09:43 UTC | `events` (`ticketmaster`) |
| `sync-places.yml` | Weekly, Mon 10:43 UTC | `places` |
| `sync-viator.yml` | See workflow | `viator_picks` |
| `sync-weather.yml` | Hourly at :17 | `weather_hourly` |

Every sync runs once per row in `public.cities` where `launched` is true, writes that city's slug onto the rows it creates, and prunes only within that city. Set `WAYVEE_CITY` (or the workflow's **city** input) to a single slug to sync just one — how a newly launched city is backfilled without re-fetching the others.

The curated-events workflow runs `npm run audit:data` before it syncs — the same
gate the manual workflow above asks a human for — and always pushes whatever is
on `main`, so it can never introduce data nobody verified. Its job is the other
half of the daily refresh: past listings are deleted from the bundle as they
expire, and without a scheduled run the backend keeps serving them.

## Honesty rules (inherited from the data file header)

Home's quick-action row uses actual venue names from the active trip's
five-mile place/restaurant catalog. Its live minute clock selects cafés and
breakfast places in the morning, restaurants at lunch and dinner, coffee/a bite
in the afternoon, and sourced late-hours venues at night. Known closures are
excluded and matching known-open places are preferred. Unknown hours remain
unknown; the chips do not claim “Open now.” Each chip opens the venue's detail
page. Oakland's curated records are only mixed in for Oakland; other cities
use their own hydrated place pool. Home quick-action details use Field Guide;
Discover retains its own routes and presentation.

- Nothing is invented. Entries without verified depth say so plainly
  (e.g. seeds list "See official site for today's hours").
- Ratings appear only where a licensed/attributable source is represented —
  omit rather than estimate.
- Prices, hours, and lineups carry the date they were checked.
