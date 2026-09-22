# AGENTS.md — @vp/testing (Shared Test Fixtures & Utilities)

Instructions for any coding agent working on `@vp/testing`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/testing` provides shared test utilities, mock JWT generators, and test fixture helpers used across unit and integration test suites.
- **Dev Token Generator:** Minting signed Ed25519 JWT tokens for test roles (`admin`, `user`, `guest`).
- **Fixture Verification:** Checksum verification for deterministic synthetic media files.
- **In-Memory Helpers:** Shared assertions and factories for port doubles.

---

## 2. Invariants

- Must execute completely offline without network calls.
- Dev tokens generated here must never be used in production environments.

---

## 3. Dedicated Standards

- **Testing Standards:** `docs/standards/testing.md`

---

## 4. Local Commands

```bash
pnpm --filter @vp/testing typecheck
pnpm --filter @vp/testing test
```
