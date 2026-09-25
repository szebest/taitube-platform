# AGENTS.md — @vp/api-client (Typed API Client, client tier / T4)

Instructions for any coding agent working on `packages/client/api-client`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope

The typed client the frontend calls the API through. `createApiClient` maps the `@vp/api-contracts`
registry at runtime and `ApiClient` is a mapped type over it, so **an endpoint cannot exist in the
client without existing in the contract**. `ApiClientOptions` (`request.ts`) injects `baseUrl`,
`fetch`, `credentials`, `getAuthToken` (sent as a bearer token) and extra `headers`.

- **Tier `client`** — browser only. May depend on `universal` and `client` packages, never `server`.
- **Layer T4** - one above `@vp/api-contracts` (T3); its dependencies are in [package.json](package.json).

---

## 2. Invariants

1. **Never hand-write an endpoint.** It is derived from the contract or it does not exist.
2. **Responses are validated.** A payload that does not match `contract.result` raises
   `ApiContractError`; a non-2xx raises `ApiError` carrying the parsed RFC 9457 problem document.
3. **No base URL literal.** The host is injected (`apps/web/src/base-api.ts` passes `API_BASE_URL`); a
   hardcoded external host breaks local-first (Rule 1) and fails `tests/architecture/local-first.test.ts`.
4. **Relative imports are extensionless**, as in every tier. `apps/web` reads the package from its
   source through Vite, which resolves an extensionless specifier with no override.

---

## 3. Local Commands

```bash
pnpm --filter @vp/api-client typecheck
pnpm --filter @vp/api-client test
pnpm --filter @vp/api-client build
```
