# Wayvee — TODO

Checklist derived from `docs/build-book.md` (First Edition, Jul 2026). Split into business (decisions, distribution, money) vs functional (code, build) tracks. Within each track, order top to bottom.

---

# Business Tasks

## Phase 0 — Decisions (no code, write down + hold to)

- [ ] Write down the one hero job: "Plan my next few hours" (1.2)
- [ ] Write down 90-day freeze list — no social feed, no second city, no in-app booking engine, no general chat, no new Home-competing surface (1.4)
- [ ] Set decision date #1 — when to judge 90-day plan success/fail (1.5)
- [ ] Set decision date #2 — date for first real distributor conversation (1.5)
- [ ] Re-confirm launch zone locked to Downtown Oakland only (1.3 — already true, just note it)

## Phase 1 — Business-side audit reading

- [ ] Read `docs/how-we-make-money.md` in full
- [ ] Check `DATA_SOURCES.md` freshness date against today (was stale Jul 19 at doc-write time)

## Phase 4 — Distribution (Part 5)

- [ ] Confirm deep-link + PWA entry point still solid (wayvee://, wayvee.app) — already implemented, just verify
- [ ] Pick one real, founder-reachable first distributor (bar/venue/single inn) — not a hotel yet
- [ ] Get guest card in front of real guests there, review sessions daily
- [ ] Build partner snapshot dashboard only after real usage numbers exist (5.3)
- [ ] Start hotel outreach only after 5.2/5.3 produce real evidence (5.4)

## Money tracking (Part 7)

- [ ] Track cost per generated plan from first test call
- [ ] Track plan-acceptance rate
- [ ] Track handoff-tap rate by provider (Viator / Ticketmaster / TicketNetwork)
- [ ] Check periodically whether Ticketmaster/TicketNetwork tracking links have gone live (one-line fix in `links.ts` when they do)

## Weekly business beat (Part 6.7)

- [ ] Monday: review last week's real usage + top failures
- [ ] Friday: one-paragraph decision log — what shipped, what measured, what's next

## Kill-switch watch (Part 9)

- [ ] Watch scale vs stop/revise signals — acceptance rate, handoff-tap rate, trust, recovery, distribution, willingness-to-pay, founder review-time trend
- [ ] Decide retention policy for guest free-text (`rawText`) before storing any of it — privacy call, not engineering call

---

# Functional Tasks

## Phase 1 — Technical audit (read-only, verify before building)

- [x] Personally read `src/lib/plan-engine.ts` + `src/lib/itinerary.ts`

## Phase 2 — Build The Orchestrator (Part 3, 2-3 weeks)

- [x] Create `supabase/functions/concierge/index.ts` — new Edge Function
- [x] Store AI provider API key via `npx supabase secrets set` — live on Groq (`openai/gpt-oss-20b`, free tier) as a test provider. Real key is a paid OpenAI key (decided, not yet issued): set it as `CONCIERGE_API_KEY` (the only name the function reads — there is no provider-specific fallback), set `CONCIERGE_MODEL` to an OpenAI model (e.g. `gpt-4o-mini`) and `CONCIERGE_BASE_URL` to `https://api.openai.com/v1`, then re-run `npm run eval:concierge` for a real baseline and `npm run functions:deploy`.
- [x] Define `ConciergeRequest` type — enum-only fields (pace, budget, moodTags, timeWindow, wantsNightlife, confidence)
- [x] Write adapter: ConciergeRequest → `solveNight()` inputs (reuse `RESTAURANTS`, `NIGHTLIFE_SPOTS`, `currentEventListings` from `data.ts`)
- [x] Wire adapter to existing `rankRestaurants` / `rankEvents` / `solveNight` (plan-engine.ts widened, not rewritten — see adapter.ts conflict note)
- [x] Define tool-calling wrappers: `searchRestaurants`, `searchEventsTonight`, `searchNightlife`, `rankAndSolveNight`, `checkWeatherNow` (`src/lib/concierge/tools.ts`)
- [x] Add freshness/confidence guardrail — check `sync_status`, honest fallback-plan flagging, data overrides model prose on any numeric conflict
- [x] Write 50-scenario evaluation set (model on `plan-engine.test.ts` style) — 50/50 passing locally (`concierge.test.ts`); live-parse layer (`eval-concierge.ts`) run against deployed key: **45/50 (90.0%)** on `openai/gpt-oss-20b` via Groq (test provider — see below). Failures cluster on budget-word inference ("cheap"→$, "upscale"→$$$) and nightlife-from-midnight inference; re-baseline once the real paid key (OpenAI) is wired.

## Phase 3 — Guest Experience (Part 4)

- [x] Add Ask entry point on Home — reuse existing search-bar visual + bottom-sheet pattern (`overlays.tsx`) — pulled forward, needed to hand-test Phase 2
- [x] Build Plan screen — reuse existing detail-template language from `create.tsx` (`src/app/plan.tsx`, shared `TimelineStop` extracted to `src/components/timeline-stop.tsx`)
- [x] Add distinct low-confidence/fallback plan state ("Browse instead" path)
- [x] Verify every handoff link still works (OpenTable/Uber/DoorDash/Ticketmaster/Viator) — `npm run links:probe` was crashing outright (its loader assumed `data.ts` had zero imports; it now imports `events.ts`) and has been fixed; 164/164 checked URLs resolve (real per-venue reserveUrl/menuUrl/sourceUrl values, no invented OpenTable integration — Wayvee never had one)
- [x] Wire weather-triggered recovery prompt (reuse `rankEvents`/`solveNight`, `notifications.ts`, `reminders.ts`) — `src/lib/concierge/recovery.ts` + wired in `_layout.tsx`
- [x] Add learning-signal capture: accepted / replaced / completed / abandoned / rated (new lightweight table) — `concierge_signals` table + `src/lib/concierge/signals.ts`; `shown`/`accepted`/`refined`/`abandoned` wired live in `store.ts`/`plan.tsx`, `completed`/`rated` have no UI surface yet so the enum accepts them but nothing writes them

## Weekly functional beat (Part 6.7)

- [ ] Wednesday: ship week's fixes, re-run full 50-scenario eval set

## Engineering watch list (Part 9.3 risks)

- [ ] Measure real Edge Function response latency from first test call — infra ready (`concierge_runs` table + `npm run backend:health` now prints a 7-day avg latency/tokens line), just needs real traffic
- [ ] Track cost-per-plan weekly (tool-calling loops can multiply model calls silently) — same `concierge_runs`/`backend:health` line covers this once real traffic exists
- [x] Test rule-6 fallback (browsing works with AI key deliberately removed) — `src/lib/concierge/__tests__/client.test.ts` locks in null-on-every-failure-path (204 decline, invoke error, malformed payload, thrown network error) and now also retries once on a transient network throw before giving up
- [ ] Never let model's self-rated confidence substitute for the real freshness check
