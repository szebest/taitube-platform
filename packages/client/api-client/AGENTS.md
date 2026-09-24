# AGENTS.md — @vp/api-client (Typed API Client, client tier / T4)

Instructions for any coding agent working on `packages/client/api-client`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

The typed client the frontend calls the API through. `createApiClient` maps the `@vp/api-contracts`
registry at runtime and `ApiClient` is a mapped type over it, so **an endpoint cannot exist in the
client without existing in the contract**. Base URL, credentials and bearer token are injected.

- **Tier `client`** — browser only. May depend on `universal` and `client` packages, never `server`.
- **Layer T4** — may depend on T1 through T3 (`@vp/api-contracts`).

---

## 2. Invariants

1. **Never hand-write an endpoint.** It is derived from the contract or it does not exist.
2. **Responses are validated.** A payload that does not match `contract.result` raises
   `ApiContractError`; a non-2xx raises `ApiError` carrying the parsed RFC 9457 problem document.
3. **No base URL literal.** The host is injected from config — a hardcoded host breaks local-first
   (Rule 1) and is asserted against in `apps/web`.
4. **Relative imports are extensionless**, as in every tier. `apps/web` resolves them through the one
   webpack override in its `craco.config.js` (`resolve.fullySpecified: false` for workspace packages).

---

## 3. Local Commands

```bash
pnpm --filter @vp/api-client typecheck
pnpm --filter @vp/api-client test
pnpm --filter @vp/api-client build
```
