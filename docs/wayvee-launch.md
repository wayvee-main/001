# Wayvee production setup

For the ordered command sequence that takes an empty repo to a running app, see
[provisioning.md](./provisioning.md). This file is the dashboard half: Auth URLs,
Google OAuth and DNS.

## Web/PWA build

```bash
npm run build:web
npm run preview:web
```

Vercel publishes `dist/` using the build and header rules in `vercel.json`. The export includes the PWA manifest, install icons, service worker, and pre-rendered detail routes. Production must use HTTPS for location permission, OAuth, and service workers.

Wayvee is hosted by the Vercel project `final-scope` at `wayvee.app`. Squarespace remains the registrar and authoritative DNS provider. The apex domain is canonical; `www.wayvee.app` permanently redirects to it so the public origin stays aligned with Supabase OAuth.

### Squarespace DNS

Replace the previous Netlify records with the current values shown by Vercel:

```text
A      @      216.198.79.1
CNAME  www    c317d040cf706e7e.vercel-dns-017.com
```

Do not leave the old Netlify apex A record or `www -> wayvee.netlify.app` CNAME in place. After saving the records, return to **Vercel -> Project Settings -> Domains** and refresh both domains.

## Supabase backend

Supabase provides the hosted Postgres database, authentication, automatic token refresh, Google OAuth broker, and row-level authorization. Wayvee never ships a service-role or secret key.

### 1. Create and link the project

1. Create a project at <https://supabase.com/dashboard>.
2. Open **Connect** and copy the Project URL and Publishable key.
3. Copy `.env.example` to `.env.local`, then replace the placeholders.
4. In Vercel, add the same two values under **Project Settings -> Environment Variables** for Production, Preview, and Development:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These values are embedded during the static build. After changing them, trigger a new Vercel deployment.

### 2. Apply the database safely

Fastest one-time setup: open Supabase **SQL Editor**, paste the contents of:

```text
supabase/migrations/20260929000000_wayvee_initial.sql
```

and run it.

For repeatable CLI deployments:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run backend:push
```

The migration creates profiles, preferences, plans, venue follows, and saved places. It automatically provisions profile/preference rows for new Auth users and protects every table with Row Level Security.

### 3. Configure Auth URLs

In **Authentication -> URL Configuration** set:

```text
Site URL
https://wayvee.app

Additional Redirect URLs
https://wayvee.app/**
http://localhost:8081/**
http://localhost:8082/**
wayvee://**
```

Keep email confirmation enabled for production and leave **Anonymous Sign-Ins** disabled. `restoreSession` signs out any session flagged `is_anonymous`, so enabling them would create accounts the app immediately discards.

That is a separate thing from browsing without an account, which the app does support: a signed-out guest can browse and plan, and Profile says so ("Browsing as a guest"). An account is what makes saved places, plans and follows persist. There is deliberately no sign-in wall.

Before public launch, configure custom SMTP in Supabase. The built-in email sender is intended only for testing and has strict limits.

## Google sign-in/sign-up

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen with Wayvee's app name, support email, developer contact, production domain, homepage, privacy-policy URL, and terms URL.
3. Request only the `openid`, `userinfo.email`, and `userinfo.profile` scopes.
4. Create an OAuth client of type **Web application**.
5. Add these authorized JavaScript origins:

```text
https://wayvee.app
http://localhost:8081
http://localhost:8082
```

Add `https://www.wayvee.app` only if that host is deployed and used.

6. Add this exact authorized redirect URI:

```text
https://<your-project-ref>.supabase.co/auth/v1/callback
```

7. In Supabase **Authentication -> Providers -> Google**, enable Google and paste the Web client ID and client secret.

Keep the Google client secret only in Google Cloud and Supabase. It does not belong in Expo, GitHub, Vercel, or chat. The same Wayvee button signs a returning user in and creates a first-time user automatically.

## What is automatic after setup

- Email/password and Google users share one Supabase identity system.
- Sessions restore and refresh automatically on web and native.
- A profile and preference record is created by a database trigger.
- Plans, followed venues, delivery preference, taste edits, and saved-place counts load per user.
- Plan/follow/preference changes update optimistically and synchronize to Postgres.
- Signing out clears all account-scoped in-memory state, preventing data leakage between users.
- RLS ensures signed-in users can only read or modify their own rows.
- Exact device GPS coordinates and permission state remain local to the device.

## Secrets boundary

Safe in the client:

- Supabase Project URL
- Supabase publishable key

Never expose:

- Supabase secret/service-role key
- Google client secret
- SMTP password

Privileged features such as account deletion should run in a Supabase Edge Function using server-side secrets.
