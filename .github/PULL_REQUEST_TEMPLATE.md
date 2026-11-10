## Ticket
- Ticket: <!-- e.g. docs/tickets/02-ci-dual-runtime.md -->
- Phase: <!-- e.g. 0 — Bootstrap -->

## Summary
<!-- Brief description of changes made and why -->

## PR Checklist (from docs/tickets/README.md)
- [ ] AC ticked with evidence
- [ ] Tests green under Node **and** Bun where the worker is involved (`pnpm test`, `pnpm test:bun`)
- [ ] No new external runtime dependency (local-first, SDD P9 / PRD G11)
- [ ] SDD/PRD updated if a decision changed
- [ ] Setup & environment: a new env key, service, port, migration, queue, seed entity or demo scenario updates the schema docs (`pnpm gen:env-docs`), `.env.example`, `docs/GETTING_STARTED.md`, `docs/DEMO.md`, the demo seed and `infra/environments/*` where relevant, or this PR adds none
- [ ] A bump of `oxc-transform-react`, `@vitejs/plugin-react`, `oxlint`, `oxfmt` or `vite-plus` passes `pnpm react-compiler:report` and the compiled and uncompiled differential specs
- [ ] Ticket `**Status:**` set to `done` and `python3 docs/tickets/gen-index.py` re-run

## Verification & Evidence
<!-- Paste terminal outputs proving all acceptance criteria, lint, typecheck, tests -->
```bash
# Paste verification outputs here
```

## Decisions Made / Open Questions
<!-- Any architectural decisions or notes for follow-up tickets -->
