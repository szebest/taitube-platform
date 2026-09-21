# AGENTS.md — @vp/errors (RFC 9457 Problem Details & Taxonomy)

Instructions for any coding agent working on `@vp/errors`.

---

## 1. Scope & Purpose

`@vp/errors` defines the single-sourced error taxonomy, domain error classes, and RFC 9457 Problem Details serialisation format.
- Error taxonomy is classified at the throw site:
  - `PermanentError`: Bad input, authentication/authorization failures, not found, conflicts. Never automatically retried.
  - `TransientError`: Network glitches, rate limits, temporary unavailability. Retryable with exponential backoff and jitter.
- Machine-readable error codes (`ErrorCodes`) are enumerated here and must match `docs/SDD.md` §6.2.

---

## 2. Invariants

- Every domain and adapter error must inherit from `DomainError` (`PermanentError` or `TransientError`).
- Never introduce new error codes without updating the enumeration in this package and SDD §6.2.

---

## 3. Local Commands

```bash
pnpm --filter @vp/errors typecheck
pnpm --filter @vp/errors test
```
