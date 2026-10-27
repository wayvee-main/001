# Menu and photo collection

`Collect menus and photos` runs hourly and on pipeline pushes. It is separate
from the existing regional identity collector. Its first run applies the
additive migration, seeds durable jobs, then processes a bounded first batch.
No LLM calls, model-driven browsing, raw-page commits, or paid API are used.

## Limits and checkpoints

- Separate menu/photo jobs per place, with pending, working, ready, partial,
  blocked, unavailable, unsupported and not-applicable states.
- First 500 Oakland/SF eateries have priority; all other Bay sources remain
  queued. Expired 15-minute leases can be claimed after runner loss.
- A database reservation caps **all external requests at 200/hour and 4,800/day**,
  including robots, redirects, browser subresources, PDF and image reads.
  Manual runs share these ceilings. Unused reservations are released on clean
  finish; a crashed reservation remains spent conservatively.
- Four workers, one request per host per second, 60MB aggregate source bytes,
  4MB HTML, 10MB PDFs, 64KB image-header validation, 15-minute collection loop.
- Browser fallback is limited to two pages/run and 45 GET resources/page.
  Media, fonts, stylesheets, POSTs, service workers, WebSockets and WebRTC are
  blocked. Browser resources use the same public-DNS/robots/budgeted loader.
- Extracted fields and HTTP validators are cached outside the checkout.
  Source pages are not persisted. Failures preserve the last good DB goods
  but **never turn an old cached snapshot into a successful refresh**.

## Menus

Official menus win over delivery menus. The parser supports published JSON-LD,
semantic Wix/Squarespace/common menu HTML, text PDFs and bounded scan OCR.
PDF text uses up to 12 pages; scan OCR uses up to three pages and accepts only
high-confidence same-line name/price associations. Prices printed without a
currency symbol remain exactly that way; currency is not guessed.

Actual official menu/PDF links are followed even when a homepage has a few
featured items. Featured samples and linked-but-unparsed menu documents remain
`partial`, with `menuDocuments` exposing the published original in the app.
Menus are bounded published snapshots (up to 180 items); the original link is
retained for the full/current menu and source conditions.

## Ordering and social sources

The official venue page can supply public `ubereats.com/store` and
`doordash.com/store` links. Unlinked stores need a matching business name and
street address. A conflicting branch address is rejected even for linked
stores. Adapters read published structured/SSR menu data; they do not bypass
access controls. Delivery menus carry `sourceKind`, `sourceLabel` and
`pricingContext: delivery`, and never overwrite an official menu's prices.

Venue-linked public Instagram/Facebook **post** metadata is a photo fallback.
Profiles requiring login, challenges, blocked robots paths, and opaque signed
expiring images are not imported. A blocked source is checkpointed honestly
and the queue moves on. Social/ordering coverage is therefore source dependent.

## Photos and provenance

Galleries, image metadata, srcsets, inline backgrounds and actual dish-image
associations are discovered independently of menu success. The worker checks
up to eight candidates and publishes at most three validated photos per job.
Image headers must identify a usable JPEG/PNG/WebP at least 300×180 pixels.
Logos, icons, stock-photo domains, duplicates and expiring signed links are
excluded. Source URLs/provider labels/attribution stay attached; photo bytes
are not mirrored or rehosted. A dish only gets a photo when the source itself
associates that image with that dish.

## Operations

Required existing GitHub configuration: `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` secrets and `SUPABASE_URL`,
`SUPABASE_PROJECT_REF` variables. PDF/OCR tools and pinned Playwright are
installed in the runner, outside native app dependencies. No APK reinstall.

The first workflow push uses the normal 200-request ceiling; dispatch supports
0/20/100/200. A zero-budget dispatch seeds and reports the queue without
fetching source pages. Watch the compact `menu/photo:` run summary and
`menu/photo queue:` per-field state counts. Additions, unavailable/blocked
sources and partial documents are distinct from successful structured menus.
`regional_enrichment_runs` and service-only `regional_enrichment_summary()`
retain durable observability. No service credentials enter public payloads.
