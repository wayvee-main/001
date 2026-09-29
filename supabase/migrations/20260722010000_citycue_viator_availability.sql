-- Real per-product detail: inclusions/cancellation/flags from Viator's
-- /products/{code} endpoint, and next bookable dates from
-- /availability/schedules/{code} — both non-transactional, so available
-- to the Affiliate Partner API tier this app uses. Populated by the same
-- scripts/sync-viator.ts run that fills the base row; never fabricated
-- client-side. Booking (and any per-date/per-guest exact pricing) still
-- happens on viator.com.

alter table public.viator_picks
  add column if not exists free_cancellation boolean,
  add column if not exists flags text[],
  add column if not exists inclusions text[],
  add column if not exists availability_dates text[]; -- ISO yyyy-mm-dd, next bookable dates
