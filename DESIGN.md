# Wayvee design system

The approved Smoke & Bone light palette, Nightfall dark palette and editorial refinements are the current UI contract.
Palette and dimensions come from `src/lib/tokens.ts`; regenerate the CSS,
inline palette and Tailwind tokens together with `npm run tokens`.

## Approved rules

- Keep the original Vee mark and Fraunces / DM Sans typography.
  Editorial serif headings use the reference's Fraunces 500 weight; explicit
  bold variants remain available for emphasis.
- Search uses the approved **Quiet index** page at `/search`: a Back action,
  static gradient Vee mark, Search/city heading, Recent history and four calm
  Browse links. Empty history stays honest; never seed sample searches.
  Typed queries show compact glyph rows with source-backed results from the
  active city's Field Guide, including outdoor ideas. Keep ranked typo matching,
  text scope selectors, empty feedback and Show more. Recent queries and selected
  results persist on the device, follow the city, and can be cleared.
  Home, Discover and legacy search launchers open this route. Category and
  directory pages retain their own filtering through the same `CitySearchBar`.
  **Every search bar uses Home's exact geometry:** 53px outer height, full
  content width, 999px radius, 14px left / 7px right and vertical insets,
  17px search glyph and 37px orange action. Editable fields and launchers
  share the same font, surface, edge and elevation. Keep inputs off-white in
  light mode. Do not rebuild search silhouettes separately on other screens.
- Light uses the selected **Smoke & Bone** palette: `#EFEEEB` ground,
  quiet mineral and iris washes, `#E3E1DE` matte cards, `#FFFEFA` controls
  and input fields, and aubergine `#28252A` ink.
  `BACKDROP_GRADIENTS.light` in `src/lib/tokens.ts` records the 160°,
  135° and 230° layers in back-to-front order, including alpha and stops.
  Dark keeps the original `#151117` ground and 230° / 121° / 226° Nightfall
  washes. `AppBackdrop` paints the selected theme's layers behind every screen,
  detail and onboarding page, with aspect-correct angles on web and native.
  Default cards and sheets use Smoke & Bone `#E3E1DE` in light mode and
  charcoal `#29252A` in dark mode, with faint edges and elevation.
  Discover listings use the same card fill. Controls have a separate
  `surface-control` role, using `#FFFEFA` / `#29252A`. In dark mode,
  `#29252A` is the default background for card containers, including Home tiles
  and every Discover listing. Light-mode search uses `#FFFEFA` and navigation
  uses `#F9F8F5`. Home glyph tiles use `#F8F7F4` / `#29252A`.
  Search uses its own `surface-search`
  role everywhere: Home, Discover, the search overlay, food hub and stay picks.
  Dark search retains Oyster's muted green `#28372F`; dark navigation uses
  `#29252A`. Keep these roles separate from cards so changing search never
  recolors all listings.
  Cards stay free of gradients. Manual theme changes update the
  backdrop immediately. The gradient never intercepts taps or scrolling.
  Light-mode secondary, accent, success and error inks clear AA over the wash,
  including its most saturated areas.
  Horizontal rows use an alpha edge fade on web and a trailing peek on native;
  never paint a flat background-colored fade over the wash. Discover's trail
  dots have transparent surrounds so the gradient stays continuous.
- Add 14px to the previous horizontal gutters throughout screens and layers:
  34px normally, 30px on phones up to 400px. Use `useAppGutter`.
- Home keeps four tiles, ordered Eat, Bars, Routes, Events. Restore the compact
  reference glyph cards: `home-tile` paper `#F8F7F4` in light and the existing
  charcoal `#29252A` in dark. Use level-1 raised surfaces, faint borders,
  `rounded-panel` corners, 12px insets, 100px minimum height and 10px grid gaps.
  The two columns fill the content width. Small 16px outline glyphs sit inside
  28px copper circles at top left (`#DBD8D4` light / `#48312E` dark); the real
  inventory count sits at top right in 18px medium DM Sans with tabular figures.
  Below, use a 20px Fraunces category and a short 11px DM Sans caption:
  Eat / Nearby places; Bars / After dinner; Routes / A few good stops;
  Events / Find your next show. Keep the whole card one accessible button.
  These four cards open their existing Home Field Guide pools. Their inventory
  counts and ordering follow the active city's existing source pools.
  In light mode, quick venue chips share search's off-white fill;
  dark mode retains their Oyster charcoal fill. Link your stay and the evening
  ribbon share `surface-ribbon` (`#DBD8D4` light / `#100D13` dark),
  normal theme ink and a faint edge.
  Home keeps “Shall we wander?” without supporting subtext. Its one-line search
  label reads “Search the city of Oakland” for Oakland and uses the active city;
  San Francisco is shortened to “SF” in the visible label, with the full name
  retained for accessibility.
  Link your stay is followed by a faint vertical divider and a horizontal row
  of two actual local venue chips, opening each venue's existing detail page.
  They follow the device-local daypart: cafés/breakfast 5–11, lunch 11–14,
  coffee/a bite 14–17, dinner 17–23, late bites 23–5. Recompute on the live
  minute clock and on city, location or catalog updates. Use the same trip's
  five-mile catalog, without changing Nearest's first-24 pool. Favor matching
  known-open venues; exclude known closures, deduplicate names and avoid
  generic placeholders when the catalog has no suitable match. Missing hours
  never imply “Open now.” The divider is omitted when there are no venue chips.
  Cards, tiles, containers, chips, buttons and rounded photo frames use a 1px
  `edge-card` perimeter and `edge-card-bottom` lower rim. In light mode the
  Etched paper treatment uses mineral ink `#2E2B2F` at 13% / 17%. Cards
  use a matte fill and soft outer plum shadow, without a white inset highlight;
  compact controls keep the same paper-like material. Text inputs use off-white `surface-input`
  instead of the copper card fill. Dark retains its existing 4% ink
  perimeter and shadow. Keep `edge-faint` for dividers and decorative rules.
  Apply the card edge to filled controls,
  including selected and primary controls, without boxing transparent layout
  groups or text-only links. Every elevation tier and the custom navigation
  shadow is 10% stronger in lift, blur and opacity. Chips and buttons share
  that material. Light selected choices use aubergine `#302832` with pale
  `#FFF8F1` ink; dark retains its Nightfall pairing. Primary actions use `accent-fill` /
  `on-accent`. Never hardcode white on an accent fill.
- One contrasting orange family carries through the app: action fills and
  active navigation use `#AA5034` light / `#F0835C` dark, with readable accent
  text at `#8F3F29` / `#F0835C`. Legacy category and Vee tints follow Smoke & Bone
  surfaces and orange accents. Keep the original gradient Vee mark and the
  original page gradients intact; explicit error states retain their red.
- “Your evening, with Vee” and Link your stay use `surface-ribbon`:
  `#DBD8D4` light / `#100D13` dark, with standard theme lettering and
  orange `surface-accent` icons. Its smooth 22px corners, etched edge and
  level-1 elevation match the shared card material. The ticket notches and
  perforated seam are removed. Keep its compact 61.2px minimum height.
  Home dividers stay faint.
- Home uses **Field Guide** for its browse, search, idea and collection
  layers under `/home/*`. Keep Discover’s browse screen and section layouts
  unchanged. Detail pages use the shared Ledger companion below. Reuse current fonts, page wash,
  faint edges, orange actions and the floating navigation.
  Field Guide has a city/daypart eyebrow, calm title and short supporting copy,
  one raised lead card, compact source-backed glyph facts and rows separated by
  faint rules. The lead is not repeated in the remaining list. Its details use
  existing save/plan authentication and actual source links.
- The four Home tiles use **Ledger Rested** on four separate secondary pages:
  Eat `/home/eat`, Bars `/home/bars`, Routes `/home/routes`, and Events
  `/home/events`. Each opens only its own counted inventory. The prototype's
  four-category switcher is a preview aid and does not appear on these pages.
  Keep the warm page wash, a serif category title with city below, Home's
  shared 53px search, and quiet glyph filter chips. Align the category title's
  top inset with Home's Wayvee row (10px). Omit the separate
  Home/Wayvee header row on these four category pages; the bottom navigation
  provides the Home action. Restore one raised `Start here` lead card above
  the short list, then use numbered, unboxed rows beginning at 02 with a
  one-line 18px serif name, concise category glyph/caption and a 72px right-aligned
  category fact column, separated by faint rules. Omit column-label headers.
  The lead uses a 23px serif title, a smaller outline glyph and up to two
  description lines. Keep its compact 111px minimum height, with 74px minimum
  ruled rows and a closer short-list heading. Show every result exactly
  once. Use actual prices/distances for Eat, listed
  hours for Bars, stops/travel for Routes, and day/time for Events. Do not
  fill absent source facts with invented prices, distances or durations.
  Measured distances under 0.1 mile display `<0.1 mi` throughout the app;
  never replace an unknown distance with a number. Search and filters stay
  inside the page's category and city, including when
  combined. Preserve Eat's nearest order and estimated-distance labels.
  Existing `/home/browse?category=…` links redirect to the corresponding page,
  forwarding query text; generic browse/search links open Quiet index.
  For you, Collections and Discover retain their browse layouts.
- Detail pages use the approved **Open Dossier / Menu Journal** in both
  themes, with **Event Journal** for shows. The small category/city row keeps
  Back and the actual Save/plan control. The serif name and supplied caption
  precede an inset, rounded photo: 124px for places, 182px for events. No
  full-bleed Marquee scrim or numbered metadata blocks remain. Missing/failed
  photos use the category glyph. Never invent a rating, price or destination.
- A short description is followed immediately by compact glyph metadata.
  Address, hours and service share **one inline flow**, wrapping only when the
  available phone width requires it. Address opens the existing directions
  handler. Full source values remain in About & visit and Vee's context.
  Event date/showtime/admission and doors/venue use the same inline flow;
  only published door times and age policies can appear.
- Detail renders are captures of the running app with the same backend payload
  used on Android. Approval previews must not present invented dishes, offers,
  prices, photos or artist biographies as implemented content. Report actual
  data coverage and missing-source cases. A styled scaffold is not a populated
  detail page.
- Map IDs and curated restaurant IDs share verified goods only after an exact
  city/name/street match. Backend `detail_content` supplies menus, named dish
  photos, source prices, artist/venue content and complete listing notes.
  These appear directly in the Journal body. Full menu opens inside the app;
  the external official menu remains a secondary handoff. Missing dish photos
  use text rows rather than large empty photographic cards. Refresh detail
  payloads on entry, preserving the device cache when the network is unavailable.
- Menu Journal puts menu exploration on the page: source category pills,
  two photographic dish cards, then compact additional dish rows. Filters
  include all items exactly once; a category with one result has no empty
  More dishes section. Dish taps open a native detail sheet and official-menu
  handoff. Only explicit dish photos are used, with food glyphs for absent
  images. A source-backed lunch combo or other special can use the quiet
  ribbon material; never generate a discount to fill space. Shooting Star's
  illustrated lunch-combo items retain their menu/time context and prices,
  with current ordering availability left to its official ordering page.
- Event Journal shows the real bill, a quiet official tickets/listing control,
  optional verified upgrades, the venue and evening-planning actions. Artist
  photos, support/headliner roles, age rules and upgrades need explicit source
  data. Unenriched listings retain their supplied lineup without invented
  biographies, roles, ticket prices, doors or inventory. Event-specific extras
  never transfer to another event at the same venue.
- All existing restaurant, place, nightlife, event, venue, route and experience
  routes share the same shell, including Home's entry routes. Additional source
  content, hours, calls, following, planning and booking controls remain in
  About & visit / Before you go. Experience date and guest selectors stay
  directly accessible. Directions and primary handoffs keep quiet neutral
  fills, faint edges and small orange glyphs. The source-specific labels and
  handlers remain intact. Existing authentication, saves and plans are retained.
  Ask Vee is an always-available ribbon outside the scroll view, above navigation,
  with the static gradient spiral. Its sheet answers from the open listing's
  facts and official links; missing policies and live availability stay unknown.
  Closing returns to the same scroll position. Planning carries the existing
  supported restaurant/event/venue/nightlife/route ID into the Vee planner.
- For you is **three vertical intention cards**, selected by guest-local time:
  breakfast, lunch, coffee, dinner, outdoor ideas, shows or late-night plans.
  Cards name suggestions rather than specific establishments. See all opens
  `/home/ideas`; each idea opens its own local results in Field Guide.
  Collections use the same `HomeDoorCard` and exact **83px** height as For you,
  including the horizontal Home rail. For you and Collections use actual
  **58 × 58px photo thumbnails**, with 11px corners, on Home and See all.
  Idea photos come from their own city-scoped results; collection photos come
  from a current member or its verified cover. Home search uses the same
  Collection photo. No generic stock substitution; missing/failed photos keep
  a relevant outline-glyph fallback. This does not change the ribbon or stay
  chip’s separately defined `surface-ribbon` fill. Promotions follow the daypart;
  expired events and events beyond seven days are omitted from Home shortlists.
- Eat retains the existing nearest pool and ordering: target 24 real results
  (at least 20 where the catalog has them), within five miles of the selected
  city/ZIP anchor. GPS only reorders that pool. It populates without GPS; never
  reuse Oakland's curated distances in another city. A tilde marks an estimate.
  Eat's tile count and Field Guide list use that same pool. Source photos stay
  with their named places and missing/failed photos use category glyphs.
- The second tab is **Discover** in both tab bars. Home and Discover use
  the same `CitySearchBar` and `CityChip` components in both themes: the same
  search fill, 37px orange action, 34px pills, typography, faint edges and lift.
  Discover filters remain a single scrollable row with 6px gaps; active filters
  retain their selected fill and accessible selection state.
  Bottom navigation uses a softly raised floating pill: 97% off-white in
  light mode, 97% charcoal in dark mode (`surface-navigation`), a 4% ink edge and the common 10% elevation increase.
  Active tabs have an orange icon (the Vee spiral retains its gradient),
  normal foreground medium-weight label,
  a slight 1px icon lift and a 3px orange dot below the label. Inactive icons
  and labels use muted ink. No active background box or icon well.
  Tab targets are at least 48px high; selection uses a 160ms transition and
  press feedback, respecting reduced motion. Preserve the Vee mark, selected
  accessibility state and visible rounded keyboard focus on web. Tabs and
  detail navigation share this treatment and keep the existing gutters.
- Discover's default order is On stage / More on stage, Find a good table,
  More good tables, After dinner, A little wandering, Rooms worth knowing.
- All seven Discover sections use the selected **Evening Trail** design,
  superseding Field Journal. A faint 1px thread at the left connects rust dots
  beside each section heading. Results are inset 20px, with 27px between sections.
  Listings use Fraunces 500 names and compact glyph facts over the shared
  raised card material, with the app-wide gradient visible between elements.
- On stage has one gently raised editorial lead with date, a 25px artist heading,
  brief caption, a source-based description of up to 20 words on one line
  with an ellipsis when needed
  (about 30% shorter than the previous version),
  and venue/time facts. Its right portrait is 78 × 114px
  (65 × 96px on narrow phones). Current listings replace samples.
  The hero uses level-1 elevation, 12px padding and a 12px radius. Both the hero
  and More on stage use the shared 1px surface perimeter, without affecting
  text or image contrast.
- More on stage, More good tables, After dinner and Rooms worth knowing use
  single horizontal photo rows with 16px gaps. On phones up to 600px wide, two
  complete cards fill the measured section width and line up with both edges of
  the On stage hero; a one-card pool fills that width on its own. Extra items
  remain swipeable with card-width snapping. Leave the closing edge unfaded so
  the second card's border remains visible. Wider screens retain 137px cards.
  All four have the same raised paper surface, 8px padding, 12px radius,
  level-1 shadow and shared 1px surface perimeter.
  Photos fill the card's inner width and stay 73px high. Heights fit content;
  the previous 195px minimum is removed to avoid wasted space.
- More on stage titles, captions and venue/time metadata each use one line.
  Venue text shrinks with ellipses while time remains visible on that same row.
  All Discover listing titles retain the five-word cap; other photo-row titles
  use at most three lines. Full names and facts remain on the existing details.
  For you shows two supporting events, three bars and three rooms. See all
  exposes each full pool; More good tables keeps its existing See all destination.
- Find a good table uses three individually contained restaurant notes, with right
  thumbnails, cuisine captions and price/distance glyphs. More good tables
  shows three distinct restaurants in its photo row with the same metadata.
  Names wrap naturally. **Find a good table has no See all action;
  More good tables keeps See all.**
- A little wandering uses individually contained numbered route notes
  (23px numbers, 31px columns). Both vertical sections share the other Discover
  cards' raised paper, level-1 shadow, 12px radius, 8px padding and faint 1px
  etched surface perimeter. Leave 8px between cards and remove row-divider lines.
  Find a good table keeps right-side thumbnails at 59 × 82px
  (47 × 73px on narrow phones).
- Discover uses `surface-discovery` on listing containers; its unselected
  chips match Home’s venue chips, using `surface-search` in light and
  `surface-control` in dark. Search uses `surface-search`. Faint borders, elevation, the Evening Trail thread and page-wide
  gradient remain; selected pills keep `selected-surface` / `on-selected`.
- Discover keeps category pills, full search, pull-to-refresh, city-aware data,
  See all actions, the original Vee logo and existing detail routes. Its intro
  retains the Evening Trail. “Discover” sits at the same top-left position
  and 26px Fraunces scale as Home’s Wayvee wordmark, with the city below.
- Home opens with the Fraunces Wayvee wordmark at top left,
  live weather beneath, and notification/profile actions at right. It greets
  with “Shall we wander?”. Search uses the compact city label specified above;
  omit the old city/state header and greeting repetition.
- Profile opens without a page heading, with a notification button, a 44px
  avatar and a compact serif greeting above the city name. Guest sign-in is a
  quiet inline row; three live counts use faint dividers without card fills.
  Your starting point and Preferences retain their setting rows.
  Appearance and launched-city choices open sheets. Existing authentication,
  location permissions, stay linking, saves, plans and following remain real.
  Manual Light/Dark choices override the OS in both CSS and inline colors;
  System follows OS changes. Tailwind uses class-based dark mode and the token
  generator emits the matching dark root variables.
- Shared app glyphs use the official Tabler outline family through `Glyph`,
  with theme-colored strokes and the existing per-control stroke weights.
  Legacy path-based icons, search, checks, chevrons and back controls retain
  their original outline treatment. Brand marks and rating stars keep their
  established geometry and colors.
- Every in-app Wayvee spiral uses the original three-color/four-stop gradient:
  marigold `#FFC757`, coral `#E85D2C`, cobalt `#6F5BD1`, marigold.
  Solid color props cannot override the mark. Keep its geometry and typography.
  Gradient IDs must remain unique and stable through web hydration.
- Vee keeps the Open Letter's quiet layout, simplified to a 47px gradient spiral
  and “Where to?” at 28px (26px on narrow phones). Remove the top-left Vee name,
  city and weather display; weather still informs real recommendations.
  The hero has a 56px opening gap and 18px between mark and heading.
  Only the focused Vee screen rotates its hero: one smooth seven-second turn.
  Stop on tab blur, app backgrounding and reduced motion. Other marks are static.
  Refine keeps “What should change?” and the real plan context.
- Vee's typing area is 105.6px high, 20% taller than 88px. Details, mic/focus
  and Send sit inside one 18px rounded composer boundary, using the shared faint
  edge, level-1 elevation and 80% Oyster paper. Use 10px horizontal, 5px top
  and 12px bottom padding so Details and the action buttons clear the textbox floor. The inner input stays transparent and borderless on focus.
  The textbox placeholder and accessible label read “Describe your ideal night.”
  Omit the “Your starting point” label and its margin above the composer.
  Preserve the real, generated example for empty-field submission and accessibility
  hints, alongside live search, constraints and plan refinement.
  “Start from a shape” is open by default and remains collapsible. Its toggle
  and “Other options” are plain left-aligned text actions in both themes:
  no enclosing fill, border, shadow or decorative glyph; retain 44px hit targets.
  The actual shape cards keep their containment. Options use
  Home evening ribbon's faint edge, elevation and 22px corners, retaining
  their existing `surface-raised` card fill,
  61.2px minimum height and 11px horizontal / 8.4px vertical inner padding.
  Keep its 28.9px leading slot, 7px content gap and 44px trailing action slot.
  Titles use the ribbon's 15.3/18px Fraunces; metadata uses its muted 11px DM Sans
  subtext styling with a 2px top gap. The 16px chevron uses the same orange
  `surface-accent` as Home's ribbon arrow. Each card names its actual first
  place/show, followed by only a start-time glyph and a stop-count glyph.
  The start is the first stop's time, not always the show's time. Remove the
  long venue trail, extra price/walk line and redundant option-count header;
  full stops stay on the plan and in the accessibility label. Keep one-line
  titles. The refresh action reads “Other options.” Selection, collapse and
  refresh remain functional.

## Validation

Run typecheck, lint, the relevant Jest suites, `tokens:contrast`, and the
production web export. Inspect phone layouts in both themes. Contrast covers
cards, the ribbon, selected controls and all four tile surfaces, plus 1,764
composited backdrop samples per theme across phone, tablet and desktop ratios.
The restored editorial CTA pairs clear AA in both themes.

## Previous palette reference

The notes below describe the pre-Nightfall iteration and remain as historical
context. The current rules above and generated token values govern the app.

### Earlier design system

Source of truth: [src/lib/tokens.ts](src/lib/tokens.ts). Edit that file, then
run `npm run tokens` — it regenerates:

- `src/global.css` — CSS vars (web + native via NativeWind)
- `src/lib/theme.ts` — hex palette for inline color props (`Icon`, SVG fill,
  `placeholderTextColor`, shadow colors) that can't read a CSS var
- `src/lib/tailwind-tokens.generated.js` — colors/fontSize/borderRadius
  consumed by `tailwind.config.js`

Never hand-edit the three generated files — the header comment says so, and
the next `npm run tokens` overwrites them anyway.

## Why semantic names

Old tokens were named after hue (`rust`, `peach`, `ochre`). The brand accent
already moved three times — rust-orange to teal to marquee amber to Vee coral —
without its *job* (primary CTA) changing, so the name should describe the job,
not the color. New code reaches for the semantic role name below; the old hue
names still work as aliases during migration.

**Vee Coral**: coral, marigold and cobalt over a paper-and-canvas ground — the
palette of the approved onboarding and home reference build. Coral is the CTA
and the concierge; marigold and cobalt are its two supporting signals (marigold
for a category badge or an avatar, cobalt for "Vee picked this"); everything
else is paper, canvas and ink. Roughly 20% of the screen carries colour at all,
with full strength reserved for Vee and primary actions.

| Semantic | Legacy alias | Light | Dark | Use |
|---|---|---|---|---|
| `bg` | `cream` | #FFFCF7 | #151117 | screen background |
| `surface` | — | #F6EADD | #29252A | default card surface |
| `surface-raised` | `shell` | #F6EADD | #29252A | cards, panels, peek rows |
| `surface-soft` | — | #F6EADD | #29252A | quiet card tier |
| `surface-control` | — | #F5F0E9 | #29252A | neutral controls |
| `surface-ribbon` | — | #F6EADD | #100D13 | Home ribbon and stay anchor |
| `surface-sunk` | — | #E7E0D6 | #100D13 | input wells, sheet track |
| `fg` | `ink` | #2A1B33 | #FFFDFA | primary text/icon |
| `fg-muted` | `taupe` | #716672 | #B8AAB5 | secondary text/icon |
| `fg-accent` | `peach` | #A14325 | #FF9271 | accent **text** on surfaces |
| `accent` | `rust` | #E45526 | #FF9271 | icons, borders, rails |
| `accent-fill` | `ember` | #E85D2C | #E85D2C | CTA background |
| `on-accent` | — | #FFFFFF | #FFFFFF | text/icon on accent-fill |
| `open` | `pine` | #38714F | #83D0A8 | open-now / confirmed / live |
| `warm` | `ochre` | #FFC757 | #FFC757 | marigold — **fill only** |
| `warm-strong` | `coralDark` | #543F18 | #3D2D10 | ink on a marigold fill |
| `vee` | — | #6F5BD1 | #A896FF | Vee's cobalt — fills, borders, icons |
| `vee-strong` | — | #5D4BAA | #C5BAFF | cobalt as text |
| `accent-tint` | — | #FBE4DA | #4A2A25 | coral-tinted block |
| `warm-tint` | — | #FFF3D8 | #403321 | marigold-tinted block |
| `vee-tint` | — | #E3DFF7 | #352C4D | cobalt-tinted block |
| `danger` | — | #C93537 | #FF6B6D | closed / sold out / error |
| `edge` | `sand` | ink/12% | paper/12% | borders / dividers |
| `edge-soft` | `sand2` | ink/8% | paper/8% | hairlines, placeholder stripe C |

Fixed (same value both themes): `forest`, `night`, `blush`, `blush2`, `sage`,
`mist`, `apricot`, `coral-50`.

Note that `bg` is *lighter* than `surface` in light mode: cards are warm canvas
on paper, not white on grey. `surface-soft` sits between the two — about a quarter of
the separation `surface` has from `bg` — for blocks that should read as shaped
areas of the page rather than as objects on it. In light that is a 1.04:1 step,
deliberately at the edge of perceptible, so cards on this tier carry elevation 1
there to keep from reading as flush. In dark the tier is *lighter* than the page
(1.44:1) and separates on fill alone, so the shadow is withheld — a dark shadow
on a dark ground reads as a halo, not a lift. Anything that needs to read as a
distinct object wants `surface`. `surface-raised` is the third level, and it reads
above the card in light (staying paper-white) but below it in dark (going
deeper). Both directions separate it from `surface`, which is the job; matching
the direction across themes is not.

### Three rules this palette enforces

**`accent` is not text.** The coral is 3.4:1 on paper — enough for a fill, a
border, an icon or a progress rail, short of AA for a sentence. Accent text is
`fg-accent`. The role is also a shade under the CTA hex, because the exact CTA
coral misses even the 3:1 non-text floor on `surface` (2.93:1).

**`warm` is a fill, never a lettering colour.** Marigold is 1.53:1 on paper. It
exists to be sat on; what sits on it is `warm-strong`.

**`accent` and `vee` must never be the only difference between two things.**
They separate by hue, so pair each with an icon or a label and the difference
survives colourblindness and grayscale.

### The one documented exception

White on `accent-fill` is **3.48:1** — it clears AA for large and UI text and
misses it for body copy. The coral CTA is the approved brand button, and
darkening it far enough to reach 4.5:1 would change the brand, so this is
recorded as a deliberate exception rather than silently "fixed". Keep CTA labels
at `text-body-strong` or larger and bold.

Everything else clears AA in both themes: text ≥4.5:1, non-text/UI ≥3:1.
`npm run tokens:contrast` re-verifies every pair and fails on a regression — run
it after changing any hex.

## Typeface

Two families: **Fraunces** for display (500 Medium, 600 SemiBold, 700 Bold) and
**DM Sans** for text (400 Regular, 500 Medium, 700 Bold), bundled locally with
Expo Font. `font-fraunces*` names the display weights and `font-dm*` the text
ones, across roughly 440 call sites. See `tailwind.config.js` for the aliases
and `src/app/_layout.tsx` for what is loaded.

A single Hanken Grotesk family was described here for a while and never
shipped — the serif/sans pairing has been in the code throughout.

## Type scale

Replaces 27 ad-hoc `text-[Npx]` sizes seen across the codebase with 8 named
steps. Use as Tailwind classes: `text-display`, `text-title`, etc. Tracking
travels with the size (Tailwind's fontSize tuple form), so `text-micro`
already carries its letter-spacing — pair with `uppercase` and
`font-dm-bold`, don't re-add `tracking-[...]` at the call site.

| Class | Size / line-height | Weight comes from | Where |
|---|---|---|---|
| `text-display` | 28/32, -0.8 tracking | `font-fraunces` | screen hero, wordmark |
| `text-title` | 21/26, -0.4 tracking | `font-fraunces` | detail page name |
| `text-section` | 17/22 | `font-fraunces` | section headers |
| `text-body` | 14/20 | `font-dm` | descriptions |
| `text-body-strong` | 14/20 | `font-dm-medium`/`-bold` | card titles, buttons |
| `text-label` | 12.5/16 | `font-dm-medium` | chips, list rows |
| `text-meta` | 11.5/15 | `font-dm` | distance, hours, price |
| `text-micro` | 9.5/12, +0.6 tracking | `font-dm-bold` | eyebrows, badges (+ `uppercase`) |

Existing screens still use `text-[12px]` etc. — unchanged, safe, but new code
should use the scale. Migrating a screen: map old size to nearest step
(12/12.5 → `label`; 13/13.5/14 → `body`/`body-strong`; 8.5–11.5 → `meta` or
`micro` depending on weight/case) and spot-check the diff, don't blind
find-replace.

## Radius scale

`rounded-control` (12px, buttons/inputs/small thumbnails), `rounded-card` (18px,
poster/venue/list cards and peek rows), `rounded-panel` (22px, option cards,
ribbons, the stay anchor), `rounded-sheet` (25px, the Vee hero, bottom sheets,
modals). `rounded-full` for pills — that's Tailwind's built-in, not part of this
scale. A lint rule rejects new `rounded-[Npx]` values.

## The signature: walk time

Principle 2 (walkability is the primary sort, not a filter) has no fixed
visual home today. Every card/row/detail header should carry a walk-time
marker in the same slot, same `text-meta` tabular-number treatment, colored
`open` under 5 minutes and `fg-muted` beyond — so the guest learns to scan
one column down the screen instead of re-reading each card. This is the one
bold, repeated element; everything else (warm `warm`/`warm-strong` accents,
live-now dot) stays scarce so it still reads as meaningful when it appears.

## What's not done yet

- The ~440 call sites still using `text-[Npx]` arbitrary sizes
- Shadow tokens are wired (`useElevation`), but older screens still hand-roll
  `shadow-2xs`/`shadow-sm`
- `Glyph` (real Tabler package, `src/components/glyph.tsx`) is used by the
  redesigned surfaces; the rest of the app still draws from the hand-copied
  `ICON_PATHS`. New glyphs belong in `Glyph`.
- New primitives: `SecondaryButton`, `Badge`, `ListRow`, `EmptyState`, `Sheet`,
  `Price`/`Distance`/`TimeRange` formatters
- A lint rule banning raw hex in `src/app`

Each is a separate, screen-by-screen pass — do not batch them into one diff.

## Home secondary pages — Easy Chapters and Quick Peek

For You intention pages and collection contents use Easy Chapters (A3): a quiet
numbered spine, short section headings and real source-backed entries. Eat,
Bars, Routes and Events stay four separate Quick Peek (B5) pages. The lead
poster can show a real menu preview, event imagery, or the app's illustrated
bar/walking guide. Illustration is atmospheric, never fabricated venue evidence
or a geographic map. Missing source goods remain missing.

Every following result uses `HomeResultCard`: exactly 72px high, 72×56px
thumbnail, shared padding and typography, and 10px gaps. Metadata cannot grow
one category's row; it truncates with a full accessible label. Use chevrons for
Home secondary navigation. Menu mini-windows retain their compact 52px images.
Smoke & Bone and Nightfall both use the existing app surface tokens. Measure
actual app card rectangles to verify size equality; generated images are only
concept references.

### A3 fidelity and category search

A3 is distinct from B5: For You uses orange timeline dots, horizontal photo
cards and facts beneath each card. Collections use numbered chapters and
photo-first cards. Both use the compact city/bookmark toolbar, editorial title
and one feature per chapter, with other real entries reached through See all.
The mixed A little of everything collection is composed from current nearby
food, culture and walking records only, and requires source imagery.
B5 category search starts as a toolbar glyph; tapping mounts and focuses the
normal 53px search input. Closing clears the query. Category posters have no
menu-item mini-windows; the menu remains available on the real detail page.

### B5 material fidelity

The four category pages use borderless matte cards, including their image
frames. Light uses the existing near-white `surface-control` fill against the
Smoke & Bone background; dark uses its paired Nightfall surface. Separation
comes from the soft outer shadow and 10px gaps, without gloss or inset shine.
Loading photos use a quiet neutral well; food posters prefer an actual menu
photograph when the source provides one, rather than a logo or stock image.
Their text-only filter pills and circular toolbar controls also have no outline.
Keep the uppercase city/category toolbar and the uncluttered editorial title.
The following cards stay exactly 72px high with 72×56px thumbnails. This
category-specific treatment must not change other app surfaces.

### Open Ledger replaces B4 on the four tile destinations

Eat, Bars, Routes and Events use the approved **Open Ledger** preview from
October 27: text on the left, a right-aligned **89×89px** photograph with 11px
corners, and faint full-width dividers on the page wash. No card fill, outline,
list backdrop or route index numbers. Rows are at least **122px** tall with
15px vertical padding; the first row is at least **108px**, without top padding.
Allow rows to grow for two-line titles or larger accessibility text. There is
no inter-row gap. Titles use 22px/25px Fraunces, a five-word cap and two lines;
captions use 11px/15px DM Sans and a single line. Compact inline facts use
orange 12px glyphs; prices keep their dollar text. Place the orange chevron
at the right of the facts line, before the photo. Use supplied price/distance,
published hours, route facts or event date/time; omit unknown or duplicate facts.
There is no lead poster, menu mini-window strip or floating assistant dock on
these category indexes. The detail page retains its always-available Vee action.
Restore the back/city/category toolbar and circular search toggle. The title
uses 34px Fraunces with the current result count to its right, followed by
Home's quiet filter pills. Search opens the shared focused 53px field, preserves
deep-link queries, and resets its text when closed. Match the preview's page
spacing and existing app gutters in both themes.
Every row requires a real photograph: try its own bundled photo, listing cover,
source gallery and dish photos, with successive fallback if a URL fails. Exclude
logo/icon assets and vector marks from photographic thumbnails. A route
may show a photo from a named stop only when the stop's street address matches.
Do not render photo-less or fully failed rows in these four indexes; reveal them
when their photo sources become available. Never substitute a glyph, blank well,
stock image or another venue's photo. This is scoped to the four tile pages;
the full source inventory and other app screens remain available unchanged.

### Shared menu and photo browsing

Collected menus use the existing Journal detail layout with searchable dishes,
source category filters, grouped sections and full dish details. The menu search
uses the same 53px field as Home. Keep delivery-platform pricing explicitly
labelled and attach source links to menus, dishes and photographs. Original
PDF/image menus remain accessible when structured extraction is incomplete.
The photo row opens a full image viewer with captions, attribution and source
links. Read the latest regional detail record on entry so new background goods
are visible without waiting for the nearby cache to expire.
