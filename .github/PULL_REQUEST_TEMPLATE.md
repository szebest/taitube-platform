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
- [ ] Ticket `**Status:**` set to `done` and `python3 docs/tickets/gen-index.py` re-run

## Verification & Evidence
<!-- Paste terminal outputs proving all acceptance criteria, lint, typecheck, tests -->
```bash
# Paste verification outputs here
```

## Decisions Made / Open Questions
<!-- Any architectural decisions or notes for follow-up tickets -->
