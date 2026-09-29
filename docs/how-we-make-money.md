# How Wayvee makes money

Internal reference for the team — not shown in the app. If this ever needs to
be user-facing again, it previously lived at `src/app/how-we-make-money.tsx`
and was linked from the Home footer and Profile settings.

## Where things stand today

**Every listing is picked, not bought.** Restaurants, venues, and events get
onto Wayvee because they're verified and worth a guest's time — nobody pays
for placement, and no listing outranks another because of a deal behind it.

**Delivery, rides, and ticket links go straight to the source.** When a guest
taps Order, Reserve, or Get a ride, they leave Wayvee for the real provider —
Uber Eats, DoorDash, OpenTable, Uber, Lyft. Wayvee doesn't take a cut of
those orders today (see `src/lib/links.ts` — affiliate partnerships are still
in progress, nothing is wired up yet).

**Offers are labeled by who's behind them.** The small tags above a promo
(like "UBER EATS" or "LYFT") name the actual provider the link opens.

## Update: Viator affiliate is live (as of 2026-07-22)

The "if that changes" moment happened. Wayvee is enrolled in Viator's
affiliate program (Partner ID `p00311090`) and pulls real tour/experience
listings for Oakland, East Bay, San Francisco, and Napa Valley into the
"Picks for your stay" carousel on Home.

**How it actually works:**
- `scripts/sync-viator.ts` is a manually/periodically-run script (never
  called from the client) that calls Viator's Partner API server-side
  using `VIATOR_API_KEY` — a secret that must never be committed or shipped
  to the app — and upserts sanitized rows into the `viator_picks` Supabase
  table. Same pattern as `scripts/sync-events.ts`.
- The client only ever reads `viator_picks` via the public Supabase client
  (`src/lib/viator.ts`), the same way it reads `events`. No API key touches
  the app bundle.
- Every booking link carries Viator's required tracking params
  (`pid=p00311090&mcid=...&medium=link&campaign=wayvee-picks-for-your-stay`)
  so commission attributes correctly. Tapping a Viator card hands off to
  viator.com to actually book — same "no fake in-app booking state" pattern
  as every other provider link in this app.
- Cards are labeled "VIATOR · [destination]" in the UI — same disclosure
  pattern as "UBER EATS" / "LYFT" tags elsewhere. This is genuinely paid
  placement now (Viator pays Wayvee a commission on bookings), and the
  label says so plainly rather than presenting it as an organic editorial
  pick.

**Where to find the MCID** if it needs regenerating: partner.viator.com →
Links → the Link Creator ("Viator Selector") tool. Build any sample link
and copy the `mcid=` value from the generated URL — it's not a separate
lookup field. (Double-check whatever you copy isn't `42383` — that's the
placeholder value used in Viator's own public documentation, not a real
assigned ID.)

See `PRODUCT BLUEPRINT — Wayvee` (Part I/II) for the fuller monetization
strategy and connector architecture this is one real piece of.

## Update: Tickets quick action added (as of 2026-07-22)

Home's third quick action ("Getting around", a plain Maps search — low
value) is now "Tickets", opening a Ticketmaster search for Oakland via
`ticketmasterSearchLink()` in `src/lib/links.ts`.

**This is not yet a tracked affiliate link.** wayvee.app is verified for
Ticketmaster's affiliate program (Impact) — see the `impact-site-verification`
meta tag and body text in `src/app/+html.tsx` — but no partner tracking-link
format (the Ticketmaster equivalent of Viator's `pid`/`mcid` params) has been
issued yet. Until that's available, tapping Tickets is an honest plain
handoff to ticketmaster.com with no commission attribution. Once Impact
issues a deep-link format for this program, update `ticketmasterSearchLink()`
in one place and every Tickets tap starts earning correctly.

## Update: TicketNetwork verification added (as of 2026-07-22)

wayvee.app is also now verified for TicketNetwork's affiliate program
(also via Impact) — a second `impact-site-verification` meta tag + body
text pair in `src/app/+html.tsx`, same mechanism as Ticketmaster's, separate
token since each Impact application issues its own. Same status as
Ticketmaster above: verification only, no tracking link wired up yet. Once
TicketNetwork issues one, it's a new link function in `src/lib/links.ts`
(TicketNetwork is a different marketplace than Ticketmaster, so this isn't
a drop-in replacement for `ticketmasterSearchLink()` — it'd need its own
call site wherever it's meant to show up).

## Update: Ticketmaster events sync added (as of 2026-07-25)

`scripts/sync-ticketmaster.ts` now pulls real Discovery API listings for
Downtown Oakland into the `events` table as `source='ticketmaster'` (see
DATA.md). Same server-side-key pattern as Viator: the client only reads
Supabase, the API key never ships in the bundle.

**Still not monetized, and worth being precise about why.** These are
Discovery API listings, not paid placement — nobody paid to appear, and the
curation filters (which drop ~most of what the API returns) are editorial,
not commercial. The `ticket_url` on each row is Ticketmaster's plain event
URL, so it earns nothing today — exactly the same status as the Tickets
quick action above, and for the same reason: Impact hasn't issued a
deep-link format for this program yet.

**When it does:** wrap `ticket_url`/`source_url` in `toRow()` with the same
link helper that `ticketmasterSearchLink()` gets updated to use, re-run the
sync, and every existing row picks up attribution on the next upsert. One
place, no UI change.

**Disclosure already works:** these rows carry `ticket_provider:
'Ticketmaster'`, and `src/app/event/[id].tsx` already renders "via
Ticketmaster" plus a Tickets detail fact — same provider-naming pattern as
the "UBER EATS" / "VIATOR" tags. So if attribution does get wired up later,
the label saying who's behind the link is already on screen.
