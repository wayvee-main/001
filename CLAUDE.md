## Product rulebook — Approved Editorial Home

The founder selected **Editorial** on October 8, 2026 and explicitly asked for
the exact design, including its font styling. `src/components/home-editorial.tsx`
and the `editorial-*` roles in `src/lib/tokens.ts` implement that reference.

- Use **Fraunces 500** for display headings and **DM Sans 400/500/600** for text.
- Keep the solid cream/paper ground, plum ink, coral actions, and restrained
  violet labels. Home has no full-page gradient or pastel count grid.
- Preserve this order: city/weather/profile, **Your city, a little closer**,
  **Where to / next?**, search pill, stay/late-bites/open-late chips, compact
  Eat/Shows/Bars/Routes strip, one photo-led current event, **For you**, Nearest,
  and one **Worth lingering** collection card.
- Preserve the reference spacing, thumbnail sizes, radii, and right-aligned
  distance column. Do not substitute boxed rows or horizontal Nearest cards.
- Navigation reads **Home / Tonight / Vee / You** on tabs and detail screens.
- Real catalog data supplies places, distances, weather, and dated events.
  Preview sample listings are not production fixtures or permission to invent
  facts. Event dates stay explicit; empty coverage stays honest.
- Further visual changes to this approved design require explicit direction.

## Product rulebook — Nearest

- Home's **For you → Nearest** subsection is a **vertical list of three rows**
  (or all available rows when fewer than three exist), never a horizontal rail.
- A visible **See all** action opens the separate **`/nearest` page**. That page
  lists the **entire eligible pool**, normally 20 or more results, without the
  three-row Home preview limit.
- Pool membership is within **five straight-line miles of the selected
  ZIP/city reference**. Downtown Oakland is one configured reference; other
  cities, including San Francisco, use their own reference coordinates.
- The pool populates **without location permission**. Phone coordinates only
  reorder that same pool closest first and update displayed distances.
- Use real, measured places only. Show fewer results when coverage is sparse;
  never fabricate entries or extend the radius to fill a count. Keep loading
  and unavailable-catalog status visible under Nearest.

## Implementation workflow (mandatory)

For every non-trivial task, **do not start coding immediately.**

### Phase 1 — Understand
- Read the relevant files before proposing changes.
- Understand how the current implementation works.
- Identify constraints, dependencies, and potential side effects.
- Ask clarifying questions if the request is ambiguous.

### Phase 2 — Create an implementation plan
Before writing any code, produce an implementation plan.

The plan should include:
- Problem summary
- Root cause (for bugs)
- Files that will be modified
- New files to create (if any)
- Components, hooks, stores, or services affected
- Step-by-step implementation approach
- Edge cases to consider
- Risks or trade-offs
- Testing and validation plan

**Do not generate code during this phase.**

### Phase 3 — Wait for approval
After presenting the implementation plan, stop.

Do not write code, patches, or diffs until the user explicitly approves the plan or asks you to proceed.

### Phase 4 — Implementation
After approval:

- Implement the approved plan.
- Keep changes focused and minimal.
- Reuse existing patterns before introducing new abstractions.
- Explain significant design decisions briefly.
- Update documentation when behavior changes.
- Run the appropriate validation commands before considering the task complete.

### Phase 5 — Validation
Before finishing:

- Ensure the implementation matches the approved plan.
- Verify no unrelated code was modified.
- Run all relevant checks (`typecheck`, `lint`, audits, tests, etc.).
- Report any assumptions or follow-up work.

**Never skip directly from understanding a request to writing code. Planning and explicit approval are mandatory for all non-trivial tasks.**
