# AGENTS.md — @vp/security-headers (CSP nonce and response headers)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [75](../../../docs/tickets/75-fullstack-e2e-playwright-security-perf-validation.md). `client` tier,
layer T2 (it depends on `@vp/result`).

## What it holds

- `securityHeadersMiddleware`: the TanStack Start request middleware every client app mounts from its
  `src/start.ts`. It makes a nonce per request, hands it to the render as `context.nonce`, and sets the CSP
  (`script-src 'nonce-…' 'strict-dynamic'`), `X-Content-Type-Options` and `Referrer-Policy` on the response.
- `requestNonce()`: the nonce of the request being rendered, `undefined` on the client and outside a request.
  Each app's `getRouter` passes it to `ssr.nonce`, so every script Start renders carries it.

## What does not belong here

- An app's own middleware (CSRF, redirects): it stays in that app's `src/start.ts`.
- Anything that reads app config. A policy that has to differ per app takes an argument; it never reads
  `import.meta.env`.

```bash
pnpm --filter @vp/security-headers typecheck
pnpm --filter @vp/security-headers test
```
