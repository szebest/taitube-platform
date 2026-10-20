# Making a change

How the design rules apply in this repo, and the rules for the docs a change touches. The rules themselves
live in the skills under `.agents/skills/`: design judgement, the whole-file pass and code shape in
`senior-engineering-practices`, specs in `test-discipline` and [testing.md](../standards/testing.md), comments
in `comment-discipline`.

## The whole-file pass, here

The pass and its limits are `senior-engineering-practices`, section 6 (`.agents/skills/`). What it means in
this repo:

- `pnpm knip` already fails an unused export; dead fields still go in the report.
- **Generated files are read only where you touch them**: `pnpm-lock.yaml`,
  `packages/universal/api-contracts/openapi.yaml` (`pnpm gen:contracts`), `docs/design/tokens.json` and
  `packages/client/ui/src/styles/generated/` (`pnpm gen:tokens`), the generated sections of `docs/tickets/README.md`.

## Code shape, here

The rules (plain over clever, moved code rewritten, a real parser for a real language, tagged unions, a
dependency on its current major) are `senior-engineering-practices`, section 4. Their tools in this repo:

- **Parsers in use**: PromQL through `@prometheus-io/lezer-promql`, YAML through `js-yaml`, TypeScript through
  the compiler API, as a devDependency when only tests need them.
- **A tagged union** ends its `switch` in `assertNever` from `@vp/result`. `PostgresRepositoriesConfig` in
  `packages/server/adapters/postgres/repositories/postgres-repositories.ts` is the shape;
  `no-in-probes.test.ts` rejects the `'x' in value` alternative.
- **A dependency's current major** (`senior-engineering-practices`, section 4): check it with `npm view <pkg> version`.
- **A rule that slipped gets a check, not louder prose**: the assertion goes into `tests/architecture/` with a
  fixture proving it fires, and its row into [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement).

## Docs

For specs (written by `to-spec`), tickets (`docs/tickets/`), the SDD and the agent docs:

- **Only a real feature gets a spec.** An ad hoc fix needs none, and nothing waits on one.
- **Compact.** Before calling a doc done, read it whole for duplication, wrong statements and
  contradictions.
- **Describe what ships**, rewritten in place: no deviations section, no branch history of what was added
  and removed again. A withdrawn alternative earns one line only when a reader would otherwise propose it
  again.
- **Reasons, never attribution**: "X, because Y", never who decided or agreed. Get a yes on behaviour a user
  notices before writing it down, then record the outcome alone.
- **Structural criteria** sit beside behaviour ("one component renders every variant", "the label comes
  from the same field its siblings use").
- **After a pivot**, reread the whole doc for the old shape (approach, diagrams, quoted signatures, file
  lists, questions the pivot settled) and grep the old names before saying it is updated.
- **A record stays a record.** A done ticket or a merged spec is history: a later change explains itself in
  its own PR. The living docs (`AGENTS.md`, `ARCHITECTURE.md`, `docs/SDD.md`, `docs/standards/`) change in
  the same PR as the code they describe.
- **Someone else's doc is theirs.** A doc another open PR is changing, or one the maintainer wrote, gets no
  rewrite from you: put the correction in your own doc, cite theirs, and raise it. Link repairs a move forces
  are fine.
