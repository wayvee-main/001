# Wayvee: The Build Book

*Official execution plan — First Edition — July 2026*

A complete, standalone, phase-by-phase execution plan for turning Wayvee into a working AI concierge — written for a reader with no prior context. Every instruction is paired with an honest status check against the real codebase, verified directly against the repository on the date below.

This document assumes nothing has been read before it. It does not require familiarity with any prior strategy memo. Every claim about what already exists was checked directly against the Wayvee GitHub repository — not assumed, not guessed.

| | |
|---|---|
| **Prepared for** | The Wayvee founder, starting from zero context on this plan |
| **Source material** | The Wayvee GitHub repository (branch: `main`) and the July 2026 founder strategy memo |
| **Verified against** | `origin/main`, commit `417d27f`, audited file-by-file on July 25, 2026 |
| **Reading order** | Front to back. Each Part builds on the one before it. |

Two conventions repeat throughout:

- **DO THIS — NOT BUILT YET** marks an instruction — something to actually go build. Written as direct commands because that's what they are.
- **ALREADY IMPLEMENTED** marks something that is already true today, verified directly against the repository — not aspirational, not planned, already shipped and working.
- **PARTIALLY BUILT** marks something half-built — real infrastructure exists, but it doesn't yet do the full job described.

---

## Executive Summary

For anyone who reads only one section of this document, read this one. Everything below is expanded, with evidence, in the Parts that follow.

- Wayvee is a real, live app (wayvee.app) for food and events discovery in Downtown Oakland — not a prototype. It already has a verified, sourced catalog, real-time context (weather, hours, time of day), a working deterministic planning engine, a production Supabase backend, and a live affiliate revenue stream (Part 2).
- The single thing missing is a natural-language front door: nothing today lets a guest type or say what they want and get a plan back. That is the entire scope of new work (Part 3) — not a rebuild, a new front door onto an engine that already works.
- The AI's job is deliberately narrow: turn a sentence into structured constraints, and hand those constraints to code that already ranks, validates, and explains a plan. The model is never allowed to state a fact — a price, an hour, an address — on its own authority.
- A prior founder strategy memo first proposed this direction and got the philosophy right. This document corrects four places where that memo's assumptions didn't match reality (Part 2.7) — most importantly, its "deterministic validator" already exists, and its hotel-first distribution plan is resequenced behind a founder-reachable first distributor (Part 5).
- The 90-day calendar (Part 6) is rewritten for two real actors — the founder and an AI coding agent — instead of a five-person team.
- Success is not "people like the idea." It's a plan-acceptance rate, a completed-outing rate, and — eventually — a paying distributor, measured against explicit stop/revise thresholds (Part 9), not a feeling.

> One sentence, if only one is remembered: build one honest, narrow front door onto planning logic that already works — then prove it, before spending a single hour chasing a hotel partnership.

---

# Part 0 — Start Here

## 0.1 What Wayvee Is, Today, In Plain Terms

Wayvee is a live, working app for people spending time in Downtown Oakland — tourists, hotel guests, and locals. It runs on phones (iOS and Android, built with Expo) and in a browser as an installable web app (a PWA), at **wayvee.app**. It is real, deployed, and in production today — this is not a prototype.

What a guest can already do, right now, with zero AI involved:

- Open the app and see a Home screen that already changes with the time of day — a different greeting and focus at 8 AM than at 11 PM.
- Browse a hand-picked catalog of Downtown Oakland restaurants, bars, live-music venues, and bar-crawl routes — every listing sourced from the business's own website, not invented.
- See tonight's real events at Yoshi's, the Fox Theater, the Paramount, Eli's Mile High Club, and OMCA, checked against each venue's own calendar.
- Use **"Plan my stay"** — a real, already-built feature that automatically picks one restaurant, one event, and one nightlife stop for a given night, in walkable order, avoiding repeats across nights of a trip. More on this in Part 2 — it turns out to matter enormously for what comes next.
- Save places, follow venues, build a list of "plans" (events they intend to attend), and set taste preferences — all synced to their account via Supabase, so it follows them across devices.
- Tap through to book a table, order delivery, call a ride, or buy a ticket — every one of those buttons hands off to the real provider's own site (OpenTable, Uber Eats, DoorDash, Uber, Lyft, Ticketmaster, Viator). Wayvee never pretends to complete a booking itself.

In short: Wayvee today is a well-built, honest, good-looking local guide. It knows a lot, and it already does some real planning work. What it cannot do yet is *have a conversation* — a guest cannot type "I want dinner and something fun after, nothing too far" and get a plan back. Everything today is menu-driven: tap a tab, tap a filter, tap a card.

## 0.2 What We're Building Next, And Why

The plan — first written down in a founder strategy memo in July 2026 — is to add exactly one new capability: let a guest describe what they want in plain language, and have Wayvee turn that into a real, bookable plan. Not a chatbot that answers questions. Something that finishes the job.

> The test for every decision in this document: does it help one guest go from "what now?" to a completed outing, faster and more cheaply than before? If not, it waits.

This matters because of a trap that's easy to fall into: adding a chat box to an app like this and calling it done. That would make Wayvee a "discovery app with a chatbot attached" — and that is a crowded, low-value category. Anyone can wire a chat box up to a language model and let it guess at restaurant recommendations from its training data. That is not what Wayvee should build, for a specific reason: **this app already refuses to invent facts** — hours, prices, availability, ratings are either verified and dated, or left blank. A generic chatbot breaks that promise the first time it's asked something the model doesn't actually know and answers anyway.

So the AI's job is narrower and more disciplined than "answer questions about Oakland." Its job is: turn a guest's plain-language request into constraints, hand those constraints to Wayvee's own verified catalog and its own ranking logic (which, as Part 2 shows, mostly already exists), and present the result honestly — including saying "I'm not sure" when the data doesn't support certainty.

## 0.3 How To Read This Document

This document is organized as ten Parts plus an appendix, meant to be read in order — each Part assumes you've read the ones before it.

Every fact tagged "already implemented" in this document was checked directly against the **origin/main** branch of the Wayvee repository, file by file, on July 25, 2026 — not recalled from memory, not assumed from an earlier conversation. Where this document's instructions reference a real file, function, or database table, that reference is exact and can be checked by opening that file.

---

# Part 1 — Phase 0: Lock The Foundation

Phase 0 is decisions, not code. Nothing in this Part touches the repository. Budget one week for it, done in parallel with reading Part 2.

## 1.1 The Six Rules That Can Never Change

The repository's own house rules file (`CLAUDE.md`) opens with six non-negotiable product principles. Every decision in this document — every AI feature, every UI change — must satisfy all six. This is quoted verbatim because it is the actual governing document of this codebase, not a paraphrase:

| # | Principle | Plain meaning |
|---|-----------|----------------|
| 1 | **Anchored to a place** | Discovery is always relative to where the guest *is* — never a generic city search. |
| 2 | **Walkability comes first** | Distance is the *primary sort*, not a filter. "Good and close" beats "great but far." |
| 3 | **"Right now" is live** | Time of day, open-now, weather. It feels current, like a concierge who knows the hour. |
| 4 | **Curation stays hand-picked** | Varied, deduped, editorial. Never spammy or repetitive — even if faster. |
| 5 | **Guest-first & trusted** | No ads, no checkout, no dark patterns. Serve the guest, never monetize against them. |
| 6 | **Never breaks** | Works fully even with no API key or network. Reliability *is* the concierge feel. |

Why this matters specifically for the AI layer: principle 6 is the one most AI features violate by default. A typical chatbot integration fails completely when the API key is missing, rate-limited, or the model provider is down — a spinning wheel or an error toast. Every instruction in Part 3 is written to keep the concierge feature optional-and-graceful: if the AI call fails, the guest silently falls back to the exact same tap-driven browsing that works today. Nothing new is allowed to be a single point of failure for the app.

## 1.2 Name The One Job

**[DO THIS — NOT BUILT YET]** Decide, in writing, that the single feature this entire document is organized around is: **"Plan my next few hours."** A guest describes a mood, a time budget, and maybe a constraint ("walking distance," "back by 10:30"), and gets one real, timed, walkable plan back — with two alternatives available, not a wall of options.

This is a decision, not a build task, but it has to be made explicitly and in writing because it's the filter every later decision runs through. If a feature idea doesn't serve this one job, it does not belong in the next 90 days — see 1.4.

## 1.3 Lock The Launch Zone

**[ALREADY IMPLEMENTED]** This is already effectively locked. The entire catalog, every route, every piece of copy in this app is built around Downtown Oakland specifically — not "Oakland" broadly, not a generic multi-city app. There is no code path today that handles a second city. This document treats that as a decision already made, not one still open.

## 1.4 Freeze Everything Else For 90 Days

Write this down somewhere visible and hold to it. For the next 90 days, none of the following get built, regardless of how good the idea sounds in the moment:

- A social feed, reviews, or user-generated content of any kind.
- A second city, or "add more cities" infrastructure.
- Universal in-app booking (i.e., trying to make Wayvee itself complete a reservation instead of handing off to the real provider). Part 4.3 explains why this stays a handoff, not a booking engine.
- A general-purpose chat interface that isn't tied to the one hero job in 1.2.
- Any new UI surface that competes with Home's existing single-suggestion layout for attention.

None of this means these are bad ideas forever. It means they are explicitly out of scope until the core loop (Parts 3–4) is proven to work, per the exit gates in Part 9.

## 1.5 Set The Decision Dates

**[DO THIS — NOT BUILT YET]** Pick two calendar dates right now, before writing any code, and write them down: (1) the date you'll judge whether the 90-day plan in Part 6 succeeded or failed, using the signals in Part 9; and (2) the date by which you'll have had at least one real conversation with a potential first distributor (Part 5.2) — not a hotel, something you can actually reach.

---

# Part 2 — Phase 1: Audit What Already Exists

This is the most important Part in the document, and the one most likely to surprise you. Before writing a single line of new code, it's worth seeing exactly how much of the foundation the AI layer needs is already sitting in this repository — some of it built for entirely different reasons, months before anyone was thinking about an AI concierge.

## 2.1 The Verified Catalog (Truth Layer)

**[ALREADY IMPLEMENTED]** Every restaurant, event, and venue in Wayvee's catalog already carries a source URL and a dated verification label — the exact "freshness and confidence" requirement an AI concierge needs before it can trust its own answer.

Concretely: every event object in `src/lib/events.ts` has a `sourceUrl` field pointing at the venue's own calendar page, and a `verifiedLabel` string like "Checked Jul 19 on Yoshi's official calendar." A companion file, `DATA_SOURCES.md`, lists every single official source URL behind every listing in the app — dozens of real restaurant and venue websites, each mapped to exactly what fact it backs up. This is not a plan for a future Truth layer. It is the Truth layer, already operating.

One honest caveat worth flagging here rather than hiding: the header comment in `DATA_SOURCES.md` currently reads "Current discovery listings refreshed July 19, 2026" — twelve days stale relative to today. The daily sync workflow (2.5) keeps the automated feeds current; the hand-curated catalog's own refresh cadence is worth checking against DATA.md before this document is acted on.

## 2.2 The Live Signals (Context Layer)

**[ALREADY IMPLEMENTED]** Time-of-day awareness, live weather, and real open/closed state already exist and already shape what Home shows a guest — all without any AI involved.

- `src/lib/daypart.ts` derives 'morning' through 'lateNight' from the device clock and changes what Home leads with — coffee in the morning, tonight's calendar in the evening.
- `src/lib/weather.ts` pulls a real hourly forecast from the National Weather Service into a Supabase table (`weather_hourly`), synced hourly by a scheduled job. If the sync has been down and no forecast covers the current hour, the code returns nothing rather than showing stale data as current — the exact "silence over fabricated certainty" principle this whole AI effort is built around, already implemented independently, in a file that has nothing to do with AI.
- `src/lib/hours.ts` parses real OpenStreetMap opening-hours data into an open / closed / unknown state — and 'unknown' is a real third state, never silently treated as closed.
- `src/lib/geo.ts` computes real walk-time and distance from actual coordinates — never an estimate, never a guess.

Taste, the last item in the Context layer's own list ("where, when, time, stay, budget, taste, mobility"), is also already built: `src/lib/taste.ts` turns a guest's own freeform taste tags into a real ranking signal (`affinityScore`) by literal overlap with catalog fields — no inference, no guessing at a preference the guest never stated. A companion file, `taste-onboarding.ts`, lets a guest set taste tags before even creating an account, so personalization starts on first open, not after signup. This is exactly what `plan-engine.ts`'s `rankRestaurants`/`rankEvents` already weigh candidates by — the AI layer inherits real personalization for free, without inventing a new preference model.

## 2.3 The Planning Engine You Already Have

**[PARTIALLY BUILT]** This is the single biggest finding in this document. A real, deterministic, tested planning engine already exists — `src/lib/plan-engine.ts` — and it already does most of what the strategy memo calls "the deterministic validator." It just doesn't have a natural-language front door yet.

Today, this engine powers the **"Plan my stay"** feature (the Plan tab, `src/app/(tabs)/create.tsx`). A guest sets a pace and budget with two taps; the engine does the rest. Its own header comment states its job plainly:

```
Scoring + joint-feasibility engine behind "Plan my stay".

Replaces "first item in an already-filtered array" with real
ranking: taste affinity, walkability, open-now at the actual
planned hour, and weather. Every reason a candidate scores
where it does is a real computed fact off catalog fields —
never generated text.
```

What it actually does, concretely:

- `rankRestaurants(candidates, ctx)` scores every candidate restaurant on budget fit, taste affinity, walk distance, and whether it's open at the actual planned dinner hour — a restaurant that's closed is demoted, never silently dropped, and carries an honest "Closed at that time" reason.
- `rankEvents(candidates, ctx)` does the same for events, and demotes outdoor events when real forecast rain probability crosses 40% — using the live weather data from 2.2.
- `solveNight(inputs)` is the orchestrator: it picks one event, then a restaurant walkable from that event, then an optional nightlife stop walkable from the restaurant — using each stop's real coordinates for the next leg. It respects a guest's locked choices and their walk-budget preference, and it **always returns a plan** — even a compromised one — rather than an empty screen.
- `computeDinnerTime(event, date)` anchors dinner 105 minutes before a real event start time, with a sane fallback for matinees.
- It ships with 38 real automated tests (`src/lib/__tests__/plan-engine.test.ts`) covering exactly this behavior — closed-restaurant demotion, rain demotion, walk-budget fallback, locked-pick honoring.

What it does **not** do: take free-text input. A guest cannot type "something fun and not too far" into it — every input (pace, budget, locks) comes from taps on fixed UI controls. It also only plans one night at a time, not a multi-day trip, and its output (a restaurant, an event, an optional nightlife stop) is not persisted anywhere beyond the guest's own device — see the sibling file below.

A second file, `src/lib/itinerary.ts`, stores the result of a plan-engine run per calendar night on the guest's own device (not Supabase — deliberately, per a comment in the file explaining that draft plans aren't "saves/plans/taste/auth" in the sense CLAUDE.md reserves for account sync). Its core type is worth seeing directly, because it's the closest thing to an "Itinerary schema" that exists today:

```ts
interface NightDraft {
  generated: boolean;
  restaurantId: string | null;
  eventId: string | null;
  nightlifeSpotId: string | null;
  lockedRestaurant: boolean;
  lockedEvent: boolean;
  lockedNightlife: boolean;
}
```

> Why this changes Part 3: the strategy memo asked for "a deterministic plan validator, built before adding more model capability." That validator already exists. The AI layer's real job is not to build a new planning system — it's to become a new front door onto this one: translate a guest's sentence into the same constraints `solveNight()` already accepts, and let the already-tested engine do the actual planning.

## 2.4 The Money Already Flowing

**[ALREADY IMPLEMENTED]** Wayvee already earns real commission today. This isn't a future business-model slide — it's a shipped, working affiliate integration, verified against `docs/how-we-make-money.md`.

As of July 22, 2026, Wayvee is enrolled in Viator's affiliate program and pulls real tour and experience listings for Oakland, the East Bay, San Francisco, and Napa Valley into the "Picks for your stay" carousel on Home. A scheduled server-side job (`scripts/sync-viator.ts`, never run from the guest's device) calls Viator's API with a secret key and writes sanitized rows to a Supabase table; every booking link a guest taps carries Viator's real tracking parameters so commission attributes correctly; and every card is honestly labeled "VIATOR · [destination]" in the UI, disclosing that this is paid placement rather than presenting it as an organic editorial pick.

Two more affiliate programs are verified but not yet earning:

- **Ticketmaster** — wayvee.app is verified for Ticketmaster's Impact affiliate program, and a real Ticketmaster Discovery API sync already pulls live Oakland event listings into the same `events` table used by the hand-curated catalog. The link itself just isn't tagged with a tracking parameter yet, because Impact hasn't issued one for this program.
- **TicketNetwork** — verified the same way, same status: real integration, no tracking link wired up yet.

This matters for Part 7: the AI layer doesn't need to invent a new way to make money. It needs to get guests to the links that already earn, more often, more relevantly, and with less friction than tapping through several browse screens.

## 2.5 The Backend You Already Have

**[ALREADY IMPLEMENTED]** A production Supabase backend, five scheduled data-sync jobs, and a self-monitoring health check already exist and run automatically.

The database (14 migrations, applied in order) has real tables for: guest profiles and preferences (including pace and budget preference, the exact enums `plan-engine.ts` consumes), saved places, followed venues, planned events, the curated + Ticketmaster-sourced event catalog, Viator picks, a bulk places directory (sourced from Overture Maps and OpenStreetMap), hourly weather, and a `sync_runs` table that every scheduled job writes one row to per run.

| Scheduled job | Runs | Writes to |
|---|---|---|
| sync-events | Daily + on push to events.ts | events (source='curated') |
| sync-ticketmaster | Daily | events (source='ticketmaster') |
| sync-viator | Daily | viator_picks |
| sync-places | Weekly | places |
| sync-weather | Hourly | weather_hourly |

A command, `npm run backend:health`, already fails loudly when any of these five jobs has gone stale or started failing — reading the `sync_runs` table's own `sync_status` view. This is real, working data-freshness monitoring, not a Part 3 build item.

Also already solved: the secrets boundary. `docs/wayvee-launch.md` documents exactly which keys are safe in the client bundle (the Supabase project URL and public key) and which must never leave a server context (Supabase's service-role key, any third-party API secret). It explicitly states that "privileged features... should run in a Supabase Edge Function using server-side secrets" — which is exactly the pattern Part 3.2 uses for the AI orchestrator's own secret key.

## 2.6 What Genuinely Doesn't Exist Yet

Having spent five sections establishing how much is already built, here is the precise, honest gap — confirmed by a direct search of the entire repository for any reference to an AI provider (Anthropic, OpenAI, or otherwise): there are zero matches. No LLM call exists anywhere in this codebase today.

| Missing piece | Why it matters |
|---|---|
| Natural-language intent parsing | Nothing today turns a guest's sentence into pace/budget/mood constraints. Every input is a tap on a fixed control. |
| Any LLM/AI API integration | Confirmed absent by direct search. No provider, no SDK, no API key handling for one. |
| A server endpoint that can hold a secret key | There is no backend beyond Supabase's own database/auth and the scheduled sync scripts — nothing today accepts a live request and calls an AI provider. |
| Multi-slot / free-text "Ask" UI | No chat, assistant, or concierge-branded screen exists anywhere in src/app/. |
| Disruption-triggered replanning | Weather data flows into rankEvents' scoring already, but nothing today notices a change and proactively rebuilds a guest's plan. |
| Outcome signals (accept / replace / complete / abandon / rate) | No instrumentation captures what happens to a generated plan after it's shown. |

> The gap is real, but it is smaller and more specific than "build an AI concierge from scratch." It is: build one new front door (natural language in, structured constraints out) onto planning logic that already works, is already tested, and is already live in production.

## 2.7 Reconciling With The Original Strategy Memo

A July 2026 founder strategy memo first proposed the AI-concierge direction this whole document executes on. This document does not require having read it — but for anyone who has, four things changed between that memo and this Build Book, each because of what Part 2's audit actually found:

| The memo said | This document changes it because |
|---|---|
| Build a deterministic plan validator before adding model capability (a future task) | It already exists — plan-engine.ts, tested, in production (2.3). Part 3 wraps it instead of rebuilding it. |
| Primary payer: hospitality partner, pursued from week one | Hotel biz-dev is real, slow, relationship-driven work a solo founder can't reliably run alongside building the product. Part 5 sequences a founder-reachable distributor first. |
| A team of five (founder, engineer, data/ops contractor, designer, partnerships) executes the 90-day plan | Reworked for two real actors — the founder, and an AI coding agent — with interview/outreach targets scaled to match (Part 6). |
| Transaction/referral revenue is a future upside to add | It's already live — the Viator affiliate integration has been earning real commission since July 22, 2026 (Part 7.1). |

In every case, the direction is the same — the memo's core discipline (bounded AI, verified truth, honest confidence, official handoffs, no side quests) carries forward unchanged into every Part that follows. What changed is only ever the starting position: this repository, in July 2026, is further along than the memo assumed.

---

# Part 3 — Phase 2: Build The Orchestrator

This is the actual engineering work — the only Part in this document where new code gets written before any partner conversation happens. Budget two to three weeks. Everything here is buildable with no dependency on anyone else's calendar.

## 3.1 The Architecture, In Plain Terms

Skip the jargon for a moment and picture the actual request that has to happen. A guest types: *"Dinner and something fun after, nothing too far, back by 10:30."* Five things need to happen, in order, before that guest sees a plan:

1. **Understand** — turn that sentence into structured constraints: pace preference, budget, a time window, maybe a mood tag like "live music."
2. **Retrieve** — pull real, current candidates from Wayvee's own verified catalog. Never let the model answer from what it happens to "remember" about Oakland restaurants — it may be wrong, outdated, or entirely invented.
3. **Decide** — rank and combine those candidates into one walkable, timed plan. This step already exists (Part 2.3) and does not need to be rebuilt.
4. **Explain** — state why this plan fits, using real computed facts, not generated prose pretending to be a fact.
5. **Hand off** — point the guest at the real reservation, ticket, or ride link for each stop. This also already exists (Part 4.3).

Only steps 1 and 4 need a language model at all. Steps 2 and 3 are exactly what `plan-engine.ts` already does today — deterministically, with no AI, already tested. This is the "LLM proposes, rules validate" pattern the original strategy memo called for, mapped onto real files instead of a diagram:

| Step | Who does it | Status |
|---|---|---|
| Understand intent | A language model, constrained to fill in known fields only | New — build in 3.3 |
| Retrieve candidates | Existing data.ts / events.ts / places.ts functions | Already built |
| Decide / rank / validate | plan-engine.ts — rankRestaurants, rankEvents, solveNight | Already built |
| Explain the choice | Real reason strings plan-engine.ts already returns | Already built |
| Hand off to booking | Existing links.ts / OpenTable / Uber / Ticketmaster / Viator links | Already built |

> The new code is smaller than it looks from the outside. It is a translator that sits in front of an engine that already works — not a new engine.

## 3.2 Do This: Stand Up The Edge Function

**[DO THIS — NOT BUILT YET]** Create one new Supabase Edge Function — a small server-side endpoint — to hold the AI provider's API key and make the actual model call. This does not exist yet anywhere in the repository.

Why this has to be a server, not the app itself: an API key for any AI provider is a secret. `docs/wayvee-launch.md` already states the rule this follows — "privileged features... should run in a Supabase Edge Function using server-side secrets" — the same pattern already used for account deletion. The app (running on a guest's phone or browser) calls this Edge Function; the Edge Function calls the AI provider; the key never ships inside the app bundle.

Concretely:

1. Create `supabase/functions/concierge/index.ts` (new file, new folder — Supabase Edge Functions are Deno-based and live under `supabase/functions/`).
2. Store the AI provider's API key as a Supabase secret (`npx supabase secrets set`), never in `.env.local`, never committed — same handling as `VIATOR_API_KEY` and `TICKETMASTER_API_KEY` already get in the sync scripts.
3. The function accepts one guest request (free text + known context like device location and any taste tags already on the account), and returns one structured response — defined next, in 3.3.

## 3.3 Do This: Define The ConciergeRequest

**[DO THIS — NOT BUILT YET]** Write one new TypeScript type describing exactly what the language model is allowed to produce. Nothing freeform — every field is one of a small number of known values.

This is the single most important guardrail in the whole system. A model that's allowed to return arbitrary text can invent a restaurant name. A model that's only allowed to fill in fields from a fixed, small set of options cannot — because everything after this step has to look the value up in the real catalog, and a made-up value simply won't be found.

Note that the two enum types below (`PacePreference`, `BudgetPreference`) are not new — they already exist as real Postgres check constraints on the `user_preferences` table (migration `20260724010000_citycue_travel_preferences.sql`) and are exactly what `plan-engine.ts` already consumes. The new request type reuses them rather than inventing a parallel vocabulary:

```ts
interface ConciergeRequest {
  rawText: string;               // the guest's own words, kept for logging only
  pace: 'Relaxed' | 'Packed' | null;      // existing PacePreference enum
  budget: '$' | '$$' | '$$$' | null;      // existing BudgetPreference enum
  moodTags: string[];             // must match a known tag vocabulary — see 3.5
  timeWindow: { startsBy: string | null; backBy: string | null };
  wantsNightlife: boolean;
  confidence: 'high' | 'medium' | 'low';  // the model's own self-rated certainty
}
```

The model's only job at this step is to fill in this object from the guest's sentence, asking a clarifying follow-up (Part 4.1) when a required field is genuinely ambiguous rather than guessing.

## 3.4 Do This: Let The AI Drive The Engine You Already Have

**[DO THIS — NOT BUILT YET]** Write the thin adapter function that turns a ConciergeRequest into the SolveInputs shape plan-engine.ts already accepts, and calls the existing solveNight() function. This is the step that makes 3.1's "translator in front of an engine" idea real.

Recall from Part 2.3 that `solveNight()` already accepts a locked/avoided pick, a pace preference, and ranked candidate lists, and already returns a full plan with real reason strings. The adapter's entire job is small:

1. Take the `ConciergeRequest` from 3.3.
2. Call the existing retrieval functions (`RESTAURANTS`, `homeEventPicks()`, `NIGHTLIFE_SPOTS` — all already in `data.ts`) to get today's real, current candidate lists — never candidates the model recalls on its own.
3. Call the existing `rankRestaurants`, `rankEvents`, and (if `wantsNightlife`) `rankNightlife` from `plan-engine.ts` against those candidates.
4. Call the existing `solveNight()` with the ranked lists and the guest's pace/budget.
5. Return `solveNight()`'s own output — including its own real `reasons` strings — back to the app. The model is never asked to write the explanation from scratch; it's handed the computed reasons and asked only to phrase them warmly.

> Nothing about plan-engine.ts changes in this step. It is called, not rewritten. This is deliberate: it already has 38 passing tests behind it, and touching it puts that test coverage at risk for no benefit.

## 3.5 Do This: Write The Tool Definitions

**[DO THIS — NOT BUILT YET]** If using a tool-calling-capable model API (recommended over a single freeform prompt), wrap a small number of existing functions as callable tools, rather than building new retrieval infrastructure.

"Tool calling" means the model is given a short list of real functions it's allowed to invoke, with typed inputs and outputs — it cannot do anything outside that list. For Wayvee, every tool wraps a function that already exists:

| Tool name | Wraps this existing function |
|---|---|
| search_restaurants | searchRestaurants() / applyRestaurantFilters() — data.ts |
| search_events_tonight | homeEventPicks() / currentEventListings() — data.ts |
| search_nightlife | NIGHTLIFE_SPOTS array — data.ts |
| rank_and_solve_night | rankRestaurants + rankEvents + solveNight — plan-engine.ts |
| check_weather_now | useWeatherNow() equivalent read — weather.ts |

Why tools instead of a bigger prompt with the whole catalog pasted in: the catalog is small and already structured (a few dozen restaurants, a few dozen events at any time) — there's no need for embeddings or a vector database here. Tool calls also mean every catalog lookup happens against live data at request time, never a stale snapshot baked into a prompt.

## 3.6 Do This: Add Guardrails On Top Of The Validator

**[DO THIS — NOT BUILT YET]** plan-engine.ts already validates feasibility (walk budget, open-now, locked picks). Add one more layer specific to the AI entry point: a freshness and confidence check before anything is shown.

- Before returning a plan, check the `sync_status` view (Part 2.5) for the `events` job. If it's stale beyond a reasonable window, say so plainly rather than presenting a possibly-outdated plan as current.
- If `solveNight()` returns a plan built entirely from fallback candidates (Part 2.3's "always returns something" behavior), surface that honestly — a narrowed or lower-confidence plan screen (Part 4.2) rather than presenting it with the same visual confidence as a strong match.
- Never let the model's own prose override a computed fact. If the model's phrasing and the underlying data disagree on anything numeric (a price, a time, a distance), the data wins and the phrasing gets regenerated or dropped.

This is the Go/No-Go rule from the original strategy memo, restated concretely: if Wayvee cannot verify a time-sensitive fact a plan depends on, the plan narrows, asks the guest to confirm, or hands off to the official source — it never fabricates certainty.

## 3.7 Do This: Build The 50-Scenario Evaluation Set

**[DO THIS — NOT BUILT YET]** Write 50 real, specific test requests — modeled on plan-engine.test.ts's own style of concrete, literal-fixture tests — and check the concierge's output against them before any guest sees it.

A larger sample, with the pass criteria written out, to show the actual shape of the full set:

| # | Request | Pass criteria |
|---|---|---|
| 1 | "Dinner and a show tonight, nothing over $$, walking distance." | No stop exceeds $$; every stop within the pace-based walk budget |
| 2 | "Something quiet, I don't want a crowd, back by 9." | No high-energy/nightlife tag; final stop time honors the 9 PM backBy |
| 3 | "It's raining — what's a good plan that's mostly indoors?" | No outdoor-tagged event when live precipProbability > 40% |
| 4 | "I already have Yoshi's tickets for 7:30, what should I do before?" | Dinner time computed 105 min before 7:30, not a generic default |
| 5 | "Cheap eats and something free tonight." | Restaurant tier = $; event priceLabel = Free where one exists |
| 6 | "Surprise me, I'm feeling adventurous." | Still returns one concrete plan, not an open-ended question |
| 7 | "Anything open right now?" | Only restaurants with a real open-now state at request time |
| 8 | "I don't want to repeat where I ate last night." | Excludes the restaurant id already in the guest's prior NightDraft |
| 9 | "What if I skip dinner and just want the show?" | Returns an event-only plan; does not force a restaurant into the result |
| 10 | A nonsense or off-topic request (unrelated to Oakland plans) | Declines gracefully with a clarifying question, invents nothing |

Scenario 10 matters as much as the other nine — a concierge that always produces a confident plan, even from a request that doesn't warrant one, is exactly the "fabricated certainty" Part 3.6's guardrail exists to prevent.

## 3.8 Do This: Wire The Ask Entry Point Into Home

**[DO THIS — NOT BUILT YET]** Add one new entry point on the existing Home screen — not a new tab, not a new competing surface. Detailed in Part 4.1.

This is listed here as the closing item of Part 3 because it's the last piece needed before the orchestrator can be used at all — but its actual UI design belongs in Part 4, which covers the whole guest-facing experience together.

## 3.9 Worked Example: One Full Request, Start To Finish

To make Part 3's five steps concrete rather than abstract, here is one real request, traced through every step, using Wayvee's actual catalog data — not a hypothetical.

> Guest types: "Dinner and something with live music tonight, walking distance, back by 10:30."

**Step 1 — Understand.** The model fills in a ConciergeRequest:

```ts
{ pace: 'Relaxed', budget: null, moodTags: ['live music'],
  timeWindow: { startsBy: null, backBy: '22:30' },
  wantsNightlife: false, confidence: 'high' }
```

Budget wasn't mentioned, so it stays null rather than the model guessing — plan-engine.ts already handles a null budget preference gracefully (it just doesn't penalize any price tier).

**Step 2 — Retrieve.** The adapter (3.4) calls existing functions, not the model's memory:

- `homeEventPicks()` returns today's real current events — as of this document's verification date, that list genuinely includes **The Spinners** at Yoshi's, dated for tonight in events.ts, tagged with the real venue address and a 6-minute ride estimate.
- `RESTAURANTS` is filtered to nearby, currently-open candidates — genuinely including **The Cook and Her Farmer** (Oysters, $$, 0.3 miles) and **Itani Ramen**, both real entries already in data.ts.

**Step 3 — Decide.** The adapter calls the existing engine, unmodified:

```ts
rankEvents(events, ctx)      // The Spinners scores highly — real 'Live music' tag match
rankRestaurants(rests, ctx)  // The Cook and Her Farmer scores highly — real 0.3mi walk
solveNight({ restaurants, events, nightlife: null, pace: 'Relaxed', ... })
```

solveNight() returns a real, already-tested output shape: an event, a restaurant, computed dinner time (105 minutes before The Spinners' real start time), and a real reason string per stop.

**Step 4 — Explain.** The model is handed plan-engine's own reason strings and asked only to phrase them warmly — it is not asked to invent a reason:

> "The Spinners are at Yoshi's tonight, and The Cook and Her Farmer is a 6-minute walk away — dinner at 5:45, doors at 7:30, and you'll be back well before 10:30."

**Step 5 — Hand off.** Two links, both already real and already working:

- The Cook and Her Farmer's real reservation/ordering link, already in data.ts.
- Yoshi's real ticket link for The Spinners, already in events.ts, sourced from Yoshi's own calendar per DATA_SOURCES.md.

Nothing in this trace required the model to know a single fact about Oakland. Its only jobs were translating the sentence into constraints (step 1) and phrasing an already-computed answer warmly (step 4). Every fact — the venue, the walk time, the dinner time, the links — came from code that existed before this document was written.

---

# Part 4 — Phase 3: The Guest Experience

With Part 3's orchestrator working, this Part covers what the guest actually sees and taps. The guiding rule, carried over from the original strategy memo: one primary action per screen.

## 4.1 The Ask Screen

**[DO THIS — NOT BUILT YET]** Add a single new entry point on Home — styled like the existing search bar guests already know ("Anything nearby tonight?"), not a new chat app bolted on top.

Concretely: reuse the existing search-bar-style component already on Home (the row that currently opens the search overlay) as the visual model for the Ask entry point, so it reads as a natural extension of something guests already understand rather than an unfamiliar new pattern. Tapping it opens a lightweight sheet — reusing the app's existing bottom-sheet pattern from `src/components/overlays.tsx` — with a text field and a small set of mood chips for guests who'd rather tap than type.

## 4.2 The Plan Screen

**[DO THIS — NOT BUILT YET]** Render the orchestrator's output (Part 3.4) using the existing detail-template visual language already used throughout the app — not a new design system.

The plan itself — restaurant, event, optional nightlife stop, in walkable timed order — is exactly what `create.tsx` already renders today from a manual "Plan my stay" run. The only new part is getting to this screen from a sentence instead of two taps. Every fact shown (walk time, price, why this stop) is a value already coming out of `solveNight()`, not new text the model writes from nothing.

When the plan is a fallback/low-confidence result (Part 3.6), this screen needs a distinct, honest state — narrower framing, a visible note about what wasn't found, and a clear path to "Browse instead" rather than presenting an uncertain plan with false confidence.

## 4.3 Official Handoffs

**[ALREADY IMPLEMENTED]** Every action a completed plan needs to hand off to already exists and already works. This step is wiring, not building.

- Restaurant reservation and ordering links — already real, per-restaurant, in `data.ts`.
- Ride requests — already real, via the existing ride sheet (Uber / Lyft).
- Delivery — already real, via the existing delivery sheet (Uber Eats / DoorDash).
- Event tickets — already real: official venue links for the curated catalog, Ticketmaster for synced listings, Viator for tours and experiences (and Viator's links already carry live commission tracking — Part 2.4).

This is why Wayvee never needs to build "universal autonomous booking," the thing the original strategy memo explicitly warned against promising. Every provider already has its own real booking flow; Wayvee's job is only to get the guest to the right one, pre-filled with as much context as each provider's own link format allows.

## 4.4 Recovery: Wiring Weather Into Replanning

**[PARTIALLY BUILT]** The hard part already exists — rankEvents() already demotes outdoor events on real forecast rain. What's missing is a trigger that notices a change after a plan has already been shown and proactively offers a rebuild.

Concretely: after a plan is generated, store which stops were weather-sensitive (an outdoor event, an outdoor-seating restaurant). If `weather.ts`'s hourly data changes materially for the guest's planned window before the plan's start time, surface a single, calm prompt — "Rain's now expected around [time] — want me to swap in an indoor option?" — reusing the same `rankEvents`/`solveNight` call from 3.4 with an updated context, not a new recovery system.

**[ALREADY IMPLEMENTED]** The delivery mechanism for that prompt already exists too. `src/lib/notifications.ts` already schedules real local, on-device notifications, and `src/lib/reminders.ts` already computes real fire times off an event's actual startsAt — currently used for "time to leave" plan reminders. The recovery prompt above is a new reason to fire a notification, not a new notification system.

## 4.5 Learning Signals

**[DO THIS — NOT BUILT YET]** No instrumentation exists yet for what happens to a plan after it's generated. This needs a small new events table or a lightweight addition to the existing sync_runs-style observability pattern — not a new analytics platform.

At minimum, capture five outcomes per generated plan, matching the original strategy memo's vocabulary:

- **Accepted** — the guest opened at least one handoff link.
- **Replaced** — the guest swapped a stop before accepting.
- **Completed** — inferred from a later app open near the plan's end time with no abandonment signal.
- **Abandoned** — the plan screen closed with no action taken.
- **Rated** — an explicit, optional thumbs up/down after the fact.

This is the only meaningfully new backend surface in the whole document beyond the Edge Function itself — everything else in Part 3 and Part 4 reuses existing tables, existing components, or existing logic.

## 4.6 Sample Screens, Described

Three screens, written out as actual copy rather than a wireframe, so a reader building this can see the intended tone before writing a line of UI code.

**The Ask sheet** — opens from Home, styled like the existing search bar:

> "What are you in the mood for tonight?"
> [ Dinner and something after, walking distance... ]
> Quick options: Live music · Something quiet · Surprise me · Free tonight

**The Plan screen** — the orchestrator's output, timed and walkable:

> *Tonight, handled — 3 stops · 2 hr 45 min*
> 5:45 Dinner at The Cook and Her Farmer · 6 min walk
> 7:30 The Spinners at Yoshi's · official ticket handoff
> Back well before 10:30. Verified 4 minutes ago.

**The recovery prompt** — triggered by 4.4's weather check, not shown unless something actually changed:

> "Rain's now expected around 7 PM — want me to swap in an indoor option?"
> [ Update my plan ]  [ Keep it as is ]

Notice what's absent from all three: no invented urgency ("only 2 spots left!"), no score out of 100, no fake percentage of confidence dressed up as a fact. Every number shown is one that already exists somewhere in the catalog or the engine's own output.

---

# Part 5 — Phase 4: Distribution

This Part deliberately reorders the original strategy memo's plan. The memo's default distribution channel is hotel partnerships — but hotel biz-dev is real, slow, relationship-driven work, not something a solo founder building the product at the same time can also reliably execute on day one. This Part sequences distribution to start only once there's something real to show.

## 5.1 The Guest Entry Point

**[ALREADY IMPLEMENTED]** The deep-link scheme already exists — `wayvee://` — and the app is already a fully installable web app at wayvee.app, per app.json and docs/wayvee-launch.md. No app-store download is required for a guest to use any of this.

This means the QR-code entry point described in the original strategy memo is not a build task at all — it's a print task. See the earlier guest-intro card produced this session for a working example: a printable card with the real logo, a short honest description, and a QR code pointing at wayvee.app.

## 5.2 The Realistic First Distributor

**[DO THIS — NOT BUILT YET]** Pick one place — a bar, a venue, a single independent hotel or inn, anywhere with foot traffic and a personal relationship already in place — and get the guest card in front of real guests there. This replaces "sign 2–3 hotels" as the actual first move.

The point of this step isn't revenue. It's real usage data: does a stranger, handed this card with no explanation, actually type a request and act on the plan they get back? That answer is needed before any pitch to a property makes sense — it turns the pitch from "here's an idea" into "here's what real guests did."

## 5.3 The Partner Snapshot

**[DO THIS — NOT BUILT YET]** Build this only after 5.2 has real numbers to show. A lightweight dashboard — sessions, plan acceptance rate, top requested moods, estimated time saved — reusing the same events table from 4.5. No guest-level personal data in the partner-facing view, ever.

## 5.4 When To Approach Hotels

**[DO THIS — NOT BUILT YET]** Only after 5.2 produces a real, defensible number (a plan-acceptance rate, a completed-outing count) and 5.3's dashboard exists to show it. At that point, the original strategy memo's hotel-partnership thesis is worth pursuing — with evidence in hand instead of a slide deck.

---

# Part 6 — The 90-Day Calendar

Adjusted from the original strategy memo's team-of-five version (a founder, a product engineer, a data/ops contractor, a designer, and a partnerships lead) to a realistic two-actor version: the founder, and an AI coding agent handling schema/orchestration/UI implementation under the founder's direction. Interview and outreach targets are scaled down to match.

| Window | Do this | Exit signal |
|---|---|---|
| **Weeks 1–2 — Define** | Read Parts 1–2 in full. Make every Part 1 decision in writing. Read this whole document once before touching code. | Every Part 1 decision is written down; Part 2's audit has been personally verified, not just read. |
| **Weeks 3–5 — Build** | Do Part 3, in order: Edge Function, ConciergeRequest, the plan-engine adapter, tool definitions, guardrails. | ≥ 90% of the 50-scenario eval set passes; no invented time-sensitive fact appears in any output. |
| **Weeks 6–7 — Ship** | Do Part 4: Ask screen, Plan screen, handoff wiring, weather recovery, learning signals. | A median request produces a usable plan in well under a minute; the full loop works on web and mobile. |
| **Weeks 8–9 — Pilot** | Do Part 5.1–5.2: get the guest card in front of real people at one real location. Review every session personally, daily. | At least 50 real sessions from people who aren't the founder; a real, non-zero plan-acceptance rate. |
| **Weeks 10–11 — Improve** | Fix whatever the pilot's failures actually were. Re-run the eval set after every change. | Plan-acceptance rate has visibly improved from week 8's baseline. |
| **Weeks 12–13 — Decide** | Do Part 5.3–5.4 only if weeks 8–11 produced real evidence. Otherwise, return to Part 9 and use the Stop/Revise signals honestly. | A specific answer to "does this work," backed by numbers — not a feeling. |

## 6.7 The Weekly Operating Cadence

Regardless of which week it is, repeat this three-beat rhythm every week:

| Monday | Wednesday | Friday |
|---|---|---|
| Review last week's real usage and the top failures the eval set or real sessions surfaced. | Ship the week's fixes. Re-run the full 50-scenario eval set before calling anything done. | Write one paragraph: what shipped, what was measured, what's next. This is the whole "decision log" — it does not need to be longer than that. |

> A week only counts if it produced one of three things: a visible product improvement, a measured piece of real user behavior, or a written decision. Activity without one of those outputs doesn't count, no matter how busy it felt.

---

# Part 7 — How This Makes Money

Grounded directly in `docs/how-we-make-money.md` — an internal reference document that already exists in the repository and already describes real, current monetization, not a future plan.

## 7.1 What's Already Earning

**[ALREADY IMPLEMENTED]** Real commission is flowing today. Wayvee has been enrolled in Viator's affiliate program since July 22, 2026 (Partner ID p00311090), and every Viator booking link a guest taps carries live tracking parameters.

This is a materially stronger starting position than the original strategy memo assumed — it described a future "transaction/referral" revenue row as an upside to add later. It's already live.

## 7.2 What's Verified But Not Wired

**[PARTIALLY BUILT]** wayvee.app is already verified for both Ticketmaster's and TicketNetwork's affiliate programs (via Impact) — real integration work is done — but neither program has issued a trackable link format yet, so tapping a Ticketmaster link today earns nothing.

This is worth checking again periodically rather than building around — per `how-we-make-money.md`, the fix when it's available is a one-line change in `links.ts`, applied once, that every existing Ticketmaster/TicketNetwork link picks up automatically on the next sync.

## 7.3 What The AI Layer Actually Adds

Be precise about this: the AI concierge does not invent a new revenue mechanism. Every dollar it could ever influence already flows through a link that exists today — Viator, and eventually Ticketmaster/TicketNetwork. What the concierge changes is **conversion**: a guest who gets one well-matched plan instead of browsing four separate tabs is more likely to actually tap through and book something. The business case for Part 3's engineering work is a lift on existing, already-live revenue — not a new revenue line.

## 7.4 The Property SaaS Question

The original strategy memo's primary payer was a hotel paying a recurring fee. Per Part 5, this document treats that as a later-stage question, not a day-one requirement — it depends on distribution proof this document sequences after the product itself works. Nothing about Part 3 or Part 4's engineering work depends on that question being answered first.

## 7.5 Unit Economics To Track From Day One

| Measure | Why |
|---|---|
| Cost per generated plan | Every orchestrator call in Part 3 costs real money (the AI provider's per-token price). Track it from the first test call. |
| Plan-acceptance rate | The single number that answers "does this actually help." |
| Handoff-tap rate by provider | Separates "guest liked the plan" from "guest actually converted" — and shows which existing affiliate link (7.1–7.2) benefits most. |
| Eval-suite pass rate over time | Should only go up as the system improves — a falling pass rate after a change is a real regression, not noise. |

## 7.6 A Simple Economics Worked Example

*The numbers below are illustrative planning estimates, not measured data — replace every one of them with a real number the moment Part 3's Edge Function is live and logging actual calls. The point is the shape of the calculation, not these specific figures.*

| Line item | Illustrative estimate | Note |
|---|---|---|
| AI cost per generated plan | A few cents | One or two model calls per plan (intent parsing + phrasing); track the real figure from the first test call, per 7.5 |
| Guest sessions per month, early pilot | A few hundred | Matches Part 6's 50-real-session pilot target, scaled up modestly |
| Plan-acceptance rate (target) | 35%+ | The Part 9.1 scale-signal threshold |
| Of accepted plans, tap-through rate on an affiliate link | 50%+ | The Part 9.1 behavior-change threshold |
| Revenue per completed Viator booking | A real commission percentage | Set by Viator's program terms, not Wayvee |

The question this answers isn't "how much money will this make" — nobody can honestly say that yet. It's "does the AI cost per plan stay small relative to what an accepted, converted plan is worth." If AI cost per plan starts approaching or exceeding the revenue a single accepted plan generates, that's a real signal to revisit the approach (fewer model calls per plan, a cheaper model for the intent-parsing step) before it's a problem at scale.

---

# Part 8 — Scale, Later

Deliberately short. Everything in this Part is explicitly out of scope until Part 9's gates pass — it's documented here so it isn't forgotten, not so it gets started early.

## 8.1 What Scale Doesn't Mean

Scale does not mean "add a second city." Every part of this app — the catalog, the copy, the walkability assumptions — is built around Downtown Oakland specifically. Scale means turning everything Part 2 audited (the manual curation work, the verification workflow, the partner onboarding steps) into something faster and cheaper to repeat, one dense guest zone at a time.

## 8.2 The Market Kit

When (not before) this becomes relevant, a repeatable "Market Kit" for a new zone should contain: geography boundaries, official data sources, a starter catalog, transit/walking assumptions, safety and closure policies, partner entry points, an evaluation-scenario set (Part 3.7's pattern, rebuilt for the new zone), and a launch dashboard (Part 5.3's pattern, reused).

## 8.3 Gates Before City Two

| Gate | Minimum bar |
|---|---|
| Density | 50–100 verified destinations in one practical zone |
| Freshness | Time-sensitive records inside a defined verification window (extend backend:health, Part 2.5, to the new zone) |
| Quality | The eval suite (Part 3.7 pattern) passes at the same rate as Oakland's |
| Distribution | At least one real distributor already generating repeat sessions, per Part 5's own evidence |
| Economics | Expected revenue (Part 7) covers the new zone's ongoing data-maintenance cost |

---

# Part 9 — How You'll Know If This Worked

A real plan includes a way to find out it's wrong. These signals — adapted from the original strategy memo — are the actual finish line for the 90-day calendar in Part 6, not a vague sense of how things are going.

## 9.1 Scale Signals vs. Stop/Revise Signals

| What to check | Scale signal | Stop / revise signal |
|---|---|---|
| Guest relevance | ≥ 35% of generated plans get accepted | < 20%, after two focused rounds of fixes |
| Behavior change | ≥ 50% of accepted plans lead to an actual tapped handoff | Guests read the plan but don't act on it |
| Trust | High usefulness rating; low factual-error rate in the eval suite | Repeated stale or misleading output |
| Recovery | Weather-triggered replans get accepted most of the time | Any disruption causes the guest to abandon |
| Distribution | The one real distributor from Part 5.2 generates repeat sessions | The card sits there and nobody uses it |
| Willingness to pay | At least one real payer, once Part 5.4 is reached | Compliments with no budget attached |
| Operational scale | The founder's own manual review time per session falls over time | It rises with every new session |

## 9.2 The Kill Switch

Don't ask whether the idea is liked. Ask whether a plan gets trusted, acted on, returned to, and eventually paid for. Three honest branches, from the original strategy memo, still hold:

- If usage is real and strong but nobody will pay for it — go back to Part 5 and test a different distributor before concluding the product is wrong.
- If a distributor engages but guests still don't act on plans — the product itself needs work; return to Part 3's eval suite and Part 4's UI before spending more on distribution.
- If neither happens after a genuine 90-day attempt — stop trying to broaden and revisit whether "plan my next few hours" (Part 1.2) is actually the right job to be solving.

## 9.3 Risks And Open Questions Worth Naming Now

An honest plan names its own risks instead of discovering them mid-build. None of these are reasons not to proceed — they're things to watch.

| Risk | Why it matters | Watch for |
|---|---|---|
| Model latency | A guest asking for "dinner tonight" won't wait 15 seconds for an answer | Measure real response time from the first Edge Function test call, not after launch |
| Cost creep | Tool-calling loops can make more than one model call per request without anyone noticing | Part 7.6's cost-per-plan metric, checked weekly, not just at launch |
| Guest privacy in free-text requests | A guest's typed request may contain more personal detail than a tap ever would | Decide a retention policy for rawText (3.3) before storing any of it — don't default to keeping everything forever |
| Provider outage | Every AI provider has downtime | Confirm the Part 1.1 rule-6 fallback (browsing works with zero AI) actually works by testing it with the key deliberately removed |
| Over-trusting the model's own confidence label | A model can rate its own answer 'high confidence' and still be wrong | Never let the model's self-rating substitute for Part 3.6's actual data-freshness check |
| Scope creep back into a chat-only product | It's tempting to keep adding conversational turns | Every added turn should be checked against Part 1.2's one hero job, not shipped because it's easy to add |

> BUILD THE LOOP. PROVE THE TRUTH.
> REMOVE THE LABOR. REPEAT THE ZONE.
>
> Wayvee does not help people browse. Wayvee gets the outing done.

---

# Appendix

## A. Glossary, For Someone Who's Never Built With AI

- **LLM** — "Large language model" — the underlying AI (e.g. an Anthropic Claude model). What actually reads the guest's sentence and decides what to do with it.
- **Orchestrator** — The code (Part 3) that sits between the guest's request and the language model — deciding what tools the model can call and what it's allowed to return.
- **Tool calling** — Giving a language model a fixed list of real functions it can invoke, with typed inputs/outputs — instead of letting it answer freely. Used throughout Part 3 so the model can only act on real, current data.
- **Schema / structured output** — Forcing a model's response into a fixed shape (Part 3.3's ConciergeRequest) instead of open-ended text — the core anti-hallucination technique this whole plan depends on.
- **Hallucination** — When a language model states something false with full confidence — the exact failure mode every guardrail in Part 3 exists to prevent.
- **Deterministic** — Code that always produces the same output for the same input, with no randomness — describes plan-engine.ts (Part 2.3) exactly, and is why it doesn't need to change.
- **Confidence / freshness** — A label stating how sure the system is, and how recently a fact was checked — already implemented today via verifiedLabel and sourceUrl (Part 2.1).
- **Edge Function** — A small server-side program (Part 3.2) that can safely hold a secret API key — as opposed to code that runs on the guest's own phone or browser, which can't.
- **RLS (Row Level Security)** — A Postgres/Supabase feature already used throughout this app's database (Part 2.5) that stops one guest's account from reading or changing another guest's data.
- **Affiliate / commission link** — A booking link tagged so the referring app (Wayvee) earns a percentage when the guest completes a purchase — already live for Viator (Part 2.4 / 7.1).

## B. Full Repo Map

Every file in `src/lib/` (35 total), verified against `origin/main`:

| File | Purpose |
|---|---|
| appearance.ts | Device-local light/dark/system theme preference |
| auth.ts | Supabase auth: email/password, Google OAuth, session restore |
| bootstrap.ts | Coordinates launch-time hydration of events/places/Viator/weather |
| calendar-export.ts | Hands a planned event to the device's native calendar app |
| clock.ts | useNow() — ticking clock for time-dependent UI |
| daypart.ts | Time-of-day-aware Home layout — Part 2.2 |
| data.ts | Curated restaurant/venue/collection catalog, filters, search |
| database.types.ts | Generated Supabase TypeScript types |
| events-remote.ts | Overlays live Supabase events onto the bundled catalog |
| events.ts | Hand-curated event catalog (daily refresh) |
| geo.ts | Real walk-time/distance helpers — Part 2.2 |
| hours.ts | Open/closed/unknown parser from real OSM data — Part 2.2 |
| icons.ts | Shared tabler-style SVG icon paths |
| itinerary.ts | Per-night plan draft persistence, device-local — Part 2.3 |
| links.ts | Centralized outbound handoff + affiliate link helpers — Part 4.3 / 7 |
| location.ts | Device GPS permission/fix management |
| monitoring.ts | Sentry error monitoring init |
| network.ts | Online/offline detection |
| notifications.ts | Local on-device notification scheduling |
| places.ts | Runtime hydration of the bulk Overture/OSM places table |
| plan-engine.ts | Deterministic ranking + joint-feasibility planning engine — Part 2.3 |
| plan-history.ts | Local snapshot log of past planned events |
| promotions.ts | Placement/tone config for delivery/ride promo cards |
| recent-searches.ts | Local recently-viewed-from-search trail |
| reminders.ts | Computes real fire times for plan/stay local notifications |
| search.ts | Universal cross-entity search index |
| shadows.ts | Theme-aware elevation/shadow helper |
| stay.ts | Device-local stay-onboarding flag |
| storage.ts | Chunked secure-storage wrapper |
| store.ts | Global Zustand state — sheets, filters, plans, taste, auth |
| supabase.ts | Supabase client init |
| taste-onboarding.ts | Device-local pre-signup taste-tag record |
| taste.ts | Turns taste tags into a ranking signal (affinityScore) |
| theme.ts | Generated hex palette for inline color props |
| user-data.ts | Supabase-synced account data: stay, plans, saves, taste, preferences |
| viator.ts | Runtime hydration of the live Viator picks table — Part 2.4 |
| weather.ts | Hourly NWS forecast, Supabase-synced — Part 2.2 / 4.4 |

Every route in `src/app/` (verified against `origin/main`):

| Route | What it is |
|---|---|
| (tabs)/index.tsx | Home — greeting, search, plans, events, nearby food, collections |
| (tabs)/discover.tsx | Tonight in Oakland — events, venues, bar crawls |
| (tabs)/create.tsx | Plan launchpad — uses plan-engine.ts + itinerary.ts directly |
| (tabs)/profile.tsx | Account hub — saved, taste, location, sign out |
| auth/callback.tsx | OAuth redirect handler |
| collection.tsx / collection/[id].tsx | Curated shortlists |
| crawl/[id].tsx | Bar-crawl route detail |
| event/[id].tsx | Event detail + tickets/admission |
| featured/index.tsx / featured/ordering.tsx | Oakland food hub + ordering comparison |
| following.tsx | Followed venues list |
| night/[id].tsx | Nightlife spot detail (plain detail screen, no planning logic) |
| notifications.tsx | Notification center |
| pick/[id].tsx / picks.tsx | Viator pick detail + list — Part 2.4 |
| place/[id].tsx | Bulk places-directory detail (Overture/OSM sourced) |
| plans.tsx | Saved plans |
| restaurant/[id].tsx | Restaurant detail — menu + reserve/order |
| saved.tsx | Saved places |
| taste.tsx | Taste preference editor |
| venue/[id].tsx | Venue detail + official calendar |

All 14 Supabase migrations, in order, and the table(s) each one owns:

| Migration | Table(s) / change |
|---|---|
| 20260716000000_citycue_user_backend | profiles, user_preferences, user_plans, venue_follows, saved_places |
| 20260719000000_citycue_auth_hardening | Hardens the new-user trigger; revokes public RPC access |
| 20260720120000_citycue_events | events table (curated calendar) |
| 20260721000000_citycue_stay | user_preferences += stay_property_name/check_in/check_out |
| 20260722000000_citycue_viator_picks | viator_picks table — Part 2.4 |
| 20260722010000_citycue_viator_availability | viator_picks += cancellation/flags/inclusions/availability |
| 20260722020000_citycue_places | places table (Overture + OSM bulk directory) |
| 20260722030000_citycue_places_cuisine | places += cuisine |
| 20260724000000_citycue_saved_places_kinds | saved_places kind check widened to include 'place','night' |
| 20260724010000_citycue_travel_preferences | user_preferences += pace_preference, budget_preference |
| 20260725000000_citycue_event_source | events += source ('curated' \| 'ticketmaster') |
| 20260725010000_citycue_places_hours | places += opening_hours (raw OSM tag) |
| 20260725020000_citycue_weather | weather_hourly table — Part 2.2 / 4.4 |
| 20260725030000_citycue_sync_runs | sync_runs table + sync_status view — Part 2.5 |

Scheduled jobs (`.github/workflows/`) already running: sync-events (daily), sync-ticketmaster (daily), sync-viator (daily), sync-places (weekly), sync-weather (hourly).

## C. Quick-Reference Checklist, Per Phase

**Phase 0 (Part 1)** — decisions only, no code:
- [ ] The six rules (1.1) are read and understood.
- [ ] The one hero job (1.2) is written down.
- [ ] The 90-day freeze list (1.4) is written down and visible.
- [ ] Both decision dates (1.5) are on a calendar.

**Phase 1 (Part 2)** — read-only audit:
- [ ] plan-engine.ts and itinerary.ts have been personally read, not just read about.
- [ ] The current DATA_SOURCES.md freshness date has been checked against today.
- [ ] how-we-make-money.md has been read in full.

**Phase 2 (Part 3)** — the build:
- [ ] Edge Function stood up, key stored as a Supabase secret (3.2).
- [ ] ConciergeRequest type defined (3.3).
- [ ] Adapter onto solveNight() written and tested (3.4).
- [ ] Tool definitions wrap existing functions only (3.5).
- [ ] Freshness/confidence guardrail added (3.6).
- [ ] 50-scenario eval set written, ≥ 90% passing (3.7).

**Phase 3 (Part 4)** — the experience:
- [ ] Ask entry point added to Home, styled like the existing search bar (4.1).
- [ ] Plan screen reuses the existing detail-template language (4.2).
- [ ] Every handoff link verified working (4.3).
- [ ] Weather-triggered recovery prompt wired (4.4).
- [ ] Accept/replace/complete/abandon/rate signals capturing real data (4.5).

**Phase 4 (Part 5)** — distribution:
- [ ] One real, founder-reachable distributor identified (5.2) — not a hotel, yet.
- [ ] Partner snapshot built only after real numbers exist (5.3).
- [ ] Hotel outreach starts only after 5.2/5.3 produce evidence (5.4).

---

*End of document. This plan is a starting position, not a contract — revise any Part of it the moment real evidence, from Part 9's own signals, says otherwise.*
