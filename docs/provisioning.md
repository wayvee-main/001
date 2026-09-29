# Provisioning Wayvee from an empty repo

The exact sequence to take `wayvee-main/001` from source to a running app.
Every command here is meant to be pasted as written, in this order.

`docs/wayvee-launch.md` covers the parts you do by clicking in a dashboard —
Auth URLs, Google OAuth, DNS. This file covers the parts you type, and says
where to stop and go read that one.

## Before you start

You need: a Supabase project, a Vercel account, and admin on the GitHub repo.
Node 22, matching CI.

Set these once per shell. Everything below reads them, so nothing has a real
value baked into it.

```bash
export PROJECT_REF=              # Supabase project ref, the subdomain of your project URL
export SUPABASE_URL="https://$PROJECT_REF.supabase.co"
export SUPABASE_PUBLISHABLE_KEY= # Project Settings -> API Keys -> publishable
export SUPABASE_SERVICE_ROLE_KEY=# Project Settings -> API Keys -> service_role. Bypasses RLS.
```

The service-role key bypasses row-level security on every table. It belongs in
your shell and in GitHub Actions secrets, never in a file in this repo and
never in the client bundle. `.env` is gitignored; `.env.example` holds
placeholders and must stay that way.

```bash
git clone https://github.com/wayvee-main/001.git wayvee && cd wayvee
npm ci
```

## Running it from CI instead

Steps 1, 2 and 4 are also available as the **Provision backend** workflow
(`.github/workflows/provision-backend.yml`) and the existing sync workflows.
That path keeps every credential in the repository's encrypted secret store
rather than on a laptop or in a chat, and it is the only path that works from
a sandboxed environment — those commonly deny outbound access to
supabase.com, api.openai.com and the sync sources, which makes the CLI
locally inert no matter how correct the credentials are.

Set the secrets and variables in step 3 first, then run the workflow with
stage `schema`, then `secrets`, then dispatch each sync. Everything below
still applies if you would rather run it yourself.

## 1. Schema

```bash
npx supabase login
npx supabase init          # creates supabase/config.toml; leaves migrations alone
npx supabase link --project-ref "$PROJECT_REF"   # prompts for the database password
npm run backend:push
```

`config.toml` records the project ref. It is not a secret and is worth
committing — after that, CLI commands stop needing `--project-ref`.

Confirm the schema landed, and that the city seed is there:

```bash
npx supabase db query --linked "select slug, launched from public.cities order by slug"
```

Eight rows, Oakland `true`, the rest `false`. That is correct — see step 7.

Regenerate the types against your project. They are currently generated from a
local Postgres carrying the same migration, so this should be a small diff or
none:

```bash
npm run backend:types
git diff --stat src/lib/database.types.ts
```

Now do **wayvee-launch.md § 3 (Auth URLs)** and **§ Google sign-in** in the
dashboard. Nothing below depends on them, but sign-in stays broken until
they're done.

## 2. Concierge

Its model key is a Supabase *function* secret, not a repo secret — the
function runs on Supabase, and the key must never be reachable from the
workflow that builds the client bundle.

```bash
npx supabase secrets set \
  CONCIERGE_API_KEY=sk-... \
  CONCIERGE_BASE_URL=https://api.openai.com/v1 \
  CONCIERGE_MODEL=gpt-4o-mini \
  --project-ref "$PROJECT_REF"
```

`CONCIERGE_BASE_URL` is any OpenAI-compatible endpoint, so the provider is
swappable without touching code. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are injected into the function automatically — do not set those here.

```bash
npm run functions:deploy
```

After this the GitHub workflow redeploys it on every push that touches
`supabase/functions/concierge/**`, so this is the only manual deploy.

Verify against the real deployment:

```bash
EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
npm run eval:concierge
```

50 real sentences, target ≥90%. **A missing key does not fail loudly** — the
function answers 204 for every request and the app quietly falls back to
browsing. If the eval reports `no_key`, the secret did not land.

## 3. GitHub secrets and variables

Repo → Settings → Secrets and variables → Actions.

Secrets:

| Name | Where it comes from |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `TICKETMASTER_API_KEY` | developer.ticketmaster.com |
| `VIATOR_API_KEY` | Viator partner dashboard |
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after step 5 |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after step 5 |

Variables:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PROJECT_REF` | your ref |
| `VIATOR_PID` | Viator partner id |
| `VIATOR_MCID` | Viator merchant id |

The two `VERCEL_*` ids don't exist until step 5, so come back for them.

## 4. First data load

The schedules won't fill an empty database soon enough to look at, so run each
sync once by hand. Weather first, since it's the cheapest way to prove the
credentials work.

```bash
export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

npm run sync:weather
npm run sync:events
npm run sync:places          # slow: Overture + Overpass, several minutes
TICKETMASTER_API_KEY=... npm run sync:ticketmaster
VIATOR_API_KEY=... VIATOR_PID=... VIATOR_MCID=... npm run sync:viator
```

Each runs once per launched city and records a row per city. Check them:

```bash
npm run backend:health
```

Or read it directly — one row per job per city, most recent run:

```bash
npx supabase db query --linked "select job, city, status, rows_written, finished_at from public.sync_status order by job, city"
```

**The event catalog is the one to look at.** The bundled snapshot in
`src/lib/events.ts` has almost no future dates left, and it is what
`sync:events` pushes. Ticketmaster is what will actually populate Tonight.
If `sync:ticketmaster` writes zero rows, the app will look empty however
healthy everything else is.

## 5. Vercel

```bash
npx vercel login
npx vercel link            # creates .vercel/project.json
cat .vercel/project.json   # orgId and projectId -> the two GitHub secrets in step 3
```

In Vercel → Project Settings → Environment Variables, add to **Production**:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These are compiled into the static build, so changing them needs a fresh
deploy, not just a restart. The build refuses to run without them —
`validate-public-env.mjs` checks the URL is a real Supabase host and the key
matches `sb_publishable_*`, so there is no half-configured deploy.

Prove the build locally before spending a deploy on it:

```bash
EXPO_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
npm run build:web
```

Then deploy, either by running the **Trigger Vercel deploy** workflow, or:

```bash
npx vercel deploy --prod
```

The workflow deploys through the Vercel CLI with a token rather than the git
integration, deliberately — the reasoning is in the workflow header.

## 6. Domain

Vercel → Project → Settings → Domains → add `wayvee.app`. DNS records are in
**wayvee-launch.md § Squarespace DNS**.

Then set the same host in Supabase → Authentication → URL Configuration as the
Site URL, or OAuth redirects will bounce to the wrong origin.

## 7. Adding a second city

The backend is per-city and so is the client, but the *curated* catalog —
restaurants, venues, nightlife, crawls — is hand-written Oakland. A launched
city with no curation of its own shows only what the syncs fetched: the bulk
places directory, events, weather and tours. That is why only Oakland ships
launched.

When you're ready:

```bash
npx supabase db query --linked "update public.cities set launched = true where slug = 'san-francisco'"
WAYVEE_CITY=san-francisco npm run sync:places
WAYVEE_CITY=san-francisco npm run sync:weather
```

`WAYVEE_CITY` is also a **city** input on each sync workflow, so you can
backfill one city from the Actions tab without re-fetching the others. An
unknown slug is an error rather than an empty run.

The city picker appears in the app automatically once more than one city is
launched.

## 8. Not covered here

- **Expo.** `app.json` still has `owner: "citycues-team"` and an `eas.projectId`
  from the previous project. Both must change before an EAS build, and both
  need an Expo organisation that exists.
- **Key rotation.** `sb_secret_4MBx…` is in the previous repository's git
  history. It is not in this repo, but that only limits the exposure — rotating
  it in Supabase is the only thing that ends it.
- **`npm run audit`.** It runs, and reports 22 failures. Five are the expired
  event catalog above. Most of the rest are assertions describing a Food Hub
  and promo treatment the app no longer has. One reads alarmingly and is not:
  "the authenticated app wall is missing" is stale, because the product is
  guest-first and `_layout.tsx` has no session gate by design.
