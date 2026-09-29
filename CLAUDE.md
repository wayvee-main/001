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