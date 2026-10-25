# Bay Area regional pool

`regional_places` is a separate source-backed identity pool. It does not launch
city catalogs, change Oakland's 500-place cap, or write/prune `places` or
`cities`. Home can query the pool around a selected-city anchor or a device
location. The collector only uses fixed geographic batches; it never receives
or records a guest's location.

## Collection

`Collect Bay Area places` runs on relevant pushes to `main`, every three hours,
and through Actions' **Run workflow**. `npx --yes tsx
scripts/sync-regional-places.ts` runs it locally with `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The workflow applies the additive migration using
the existing Supabase project/access-token/database-password settings.

The first source is OpenStreetMap through Overpass. Each query intersects an
actual named California county boundary with a small scheduling envelope. The
nine counties are San Francisco, San Mateo, Alameda, Santa Clara, Contra Costa,
Marin, Solano, Napa, and Sonoma. San Francisco mainland batches run first;
islands and other counties follow. Geographic envelopes do not substitute for
the source county boundary. Missing boundaries and partial source responses
fail the batch instead of falsely recording empty coverage.

The initial grid has 50 batches. Six batches per run and eight scheduled runs
per day normally allow the first pass in roughly 1–2 days. Endpoint failures,
rate limits, or subdivisions can extend this; app deployment does not wait for
completion. Queries are never truncated into a completed batch: results above
4,000 identities or 4 MB are subdivided, with a maximum subdivision depth of 4.

The collector uses **no LLM calls** and no commercial listing APIs. Default
limits are six actual source HTTP requests and six batches per run. Retries
consume the same budget, with at most two attempts per batch, one request at a
time, at least 10 seconds between requests, a 45-second source query timeout,
and a 60-second client timeout. HTTP 429 and long Retry-After values stop the
source stage. There is no rate-limit bypass through mirrors. Source limits
can be lowered to zero or raised to a hard maximum of 12 using
`REGIONAL_SOURCE_REQUEST_LIMIT`; `REGIONAL_BATCH_LIMIT` also caps at 12.
Default successful source download volume is bounded at approximately 24 MB
per run, plus the final streamed chunk at a cap boundary. No source HTML or
raw JSON is saved or logged. No paid API tokens are used; Actions/Supabase
usage still follows the project's existing plan.

`regional_collection_batches` is the durable checkpoint and refresh cache.
Completed tiles are not requested again for 30 days. Failures retry after 1,
4, 12, then 24 hours, honoring longer source Retry-After values. Parent tiles
are retired only after subdivision children exist. A runner crash may repeat
an idempotent upsert but cannot discard already collected places. The source
pool itself is the durable cache of extracted fields; no runner cache is
required for progress. GitHub Actions serializes collector runs.

## Identity and source goods

OSM node/way/relation IDs are typed (`node/123`, `way/123`) to avoid collisions.
Source coordinates or source-provided geometry centers are stored verbatim;
centers are representative points, not entrance locations. There is no
geocoding or coordinate simulation. Published addresses, websites, phones,
cuisine and verbatim `opening_hours` are retained when present. Missing fields
remain null, and a missing locality uses `city='sf-bay-area'` as a collection
hint. This field has no launched-city foreign key. The San Francisco county
itself supplies the `san-francisco` locality hint.

Categories include food/cafes/bars/bakeries/breweries, plus explicit source
tags for `theatre`, `cinema`, `arts_centre`, `events_venue`, `music_venue`,
`museum`, `gallery`, `park`, `nature_reserve`, `garden`, `trailhead`,
`attraction`, and `viewpoint`. Unnamed features, explicitly private/inaccessible
features, and explicitly disused/abandoned features are omitted. Trail
segments are not bulk-collected. Park status, trail difficulty, route length,
event schedules, menus, photos, and offers are never inferred from identity
records. A source-tagged venue does not imply a current event listing.

An exact typed source alias preserves the canonical place ID across tiles and
source moves. Approximate duplicates require compatible categories and at
most 30 meters separation. Equal names need matching addresses or at most
12 meters separation. Fuzzy names need a matching full street address or
published phone, with no conflicting full addresses. Ambiguous matches stay
separate, preventing nearby branches from collapsing. Major name changes on
an existing source ID are flagged for review; flagged rows do not appear in
the nearby RPC.

Each run safely seeds existing Bay Area `places` into the regional table,
retaining their IDs, Overture IDs, photos, and verified `detail_content`, and
filling missing regional goods without replacing existing rich content.
Incoming identities cannot erase rich content, images, nonnull fields, or
prior typed aliases. The old catalog is never modified. Neither missing
results nor an outage causes automatic deletion; stale closures still need
source confirmation/review. Identity coverage is separate from menu/photo
coverage.

### Regional official-source detail queue

The same workflow runs `scripts/sync-regional-details.ts` after identity
collection, using the existing deterministic schema.org/Wix/Squarespace
extractors. It checks up to 40 due records with four workers and a **hard
30-request total**, including redirects and up to two published menu links.
`REGIONAL_DETAIL_REQUEST_LIMIT` can lower this to zero; it cannot exceed 30.
The workflow's `detail_requests` input controls this separately from OSM's
six-request identity budget. There are no LLM calls, browser crawls, paid API
calls, PDF guesses, or generated menus/photos.

`detail_next_check_at`, `detail_checked_at`, and `detail_failure_count` form an
indexed durable queue. Successful sources, including readable pages without
supported detail goods, advance seven days. Unavailable sources retry after
1, 2, 4, then 7 days. Untouched records remain due when the shared request
budget is exhausted; partly read menu sources retry after one hour. This
prevents the first records from monopolizing subsequent runs. With no due
records the job succeeds with zero goods writes and zero HTTP requests.
The initial migration prioritizes SF records with no goods, then other empty
Bay records, before seeded Oakland records with existing goods. Subsequent
due timestamps keep the queue fair as more places arrive.

Legacy and regional enrichment share a server-only loader: public DNS/IP
validation at each redirect, HTTPS, 12-second requests, four-hop redirect cap,
4 MB HTML bodies, and conditional ETag/Last-Modified requests. The regional
Actions cache retains extracted goods, links, body hashes and validators,
never source HTML; parser/loader changes invalidate its key. The database
queue remains durable if the cache is unavailable. Both pipelines keep prior
goods when a source fails, preserve venue photos and retain known fields
when a new parsed payload is incomplete. A separate compact goods summary
reports actual HTTP/check/cache/menu/dish/photo/write counts per run.

Source attribution is retained per row (`source_url`, `source_license`,
`source_data_at`). OSM data is ODbL 1.0; retained Overture data is
CDLA-Permissive 2.0. Keep the corresponding attribution when displaying or
redistributing the pool.

## App contract

Public clients can select a regional place by `id` for cold deep links.
Public writes are denied; collector writes and checkpoint tables require the
service role.

```ts
supabase.rpc('nearby_regional_places', {
  p_lat: 37.7749,
  p_lon: -122.4194,
  p_radius_miles: 5, // 0.25–25, default 5
  p_limit: 200,      // 1–200, default 80
  p_offset: 0,       // 0–10000, default 0
});
```

The RPC returns `id,name,category,cuisine,address,lat,lon,website,phone,image,
opening_hours,confidence,needs_review,detail_content,city,distance_miles`.
Nullability matches `places`; `distance_miles` is numeric. Inputs are validated
(SQLSTATE `22023`); indexed latitude/longitude bounding predicates precede an
exact haversine-radius filter. Results sort by distance then ID, enabling
stable pagination for an unchanged pool. The function is read-only and never
persists the query location. `NearbyRegionalPlace` and the function signature
are included in `src/lib/database.types.ts`.

## Monitoring and validation

Each run prints one compact pool/SF/tile coverage and request/write summary,
also saved to `regional_collection_runs` with 90-day retention. Inspect failed
checkpoint rows for short operational errors. Do not infer complete county or
menu coverage from a successful partial backfill run.

```sh
npx jest scripts/lib/__tests__/regional-places.test.ts --runInBand
npm run typecheck
```

The focused tests use deterministic source fixtures and mock HTTP responses;
they do not download regional data. Confirm the first Actions run applies the
migration and reports real source requests/coverage. Pause future collection
with Actions' **Disable workflow**, or choose a zero-request manual run to
copy missing catalog goods and inspect coverage without source access.

Primary source references:

- [Overpass county areas](https://dev.overpass-api.de/overpass-doc/en/full_data/area.html)
- [Overpass bounding boxes](https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html)
- [Overpass shared-server limits](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
- [OpenStreetMap feature tags](https://wiki.openstreetmap.org/wiki/Map_features)
- [OpenStreetMap attribution and license](https://www.openstreetmap.org/copyright)

Overture's global remote Parquet reader can issue many internal HTTP range
requests. This collector uses the bounded OSM path for recurring backfill and
retains existing Overture records, so a six-request setting does not hide an
unbounded cloud scan.
