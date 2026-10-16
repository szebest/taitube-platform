# AGENTS.md - @vp/lighthouse (server tier)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [64](../../../docs/tickets/64-web-vitals-monitoring-inp-lcp-cls-real-user-measurement.md).
`server` tier, layer T2 (it depends on `@vp/domain`, T1).

## Scope

`pnpm lighthouse` (`make lighthouse`): builds `apps/client/web` into `dist/web/`, serves it with `srvx` on
`127.0.0.1` over the in-process stack (`tests/e2e/web-stack.ts`, the one `make e2e-web` runs), runs Lighthouse
CI in Playwright's Chromium and prints the performance score, LCP and CLS per URL (`src/summary.ts`).

- **A package of its own** so `@lhci/cli` and its Lighthouse stay out of every app's install and image.
- **Warn-only.** `lighthouserc.json` records the thresholds (performance 0.9, LCP 2.5 s, CLS 0.1) at `warn`;
  the page tickets raise them to `error` once they land.
- **Local-first.** The report goes to `dist/report/` through the `filesystem` target; never
  `temporary-public-storage` or an LHCI server. Chromium runs with background networking off.
- No CI job: one run builds the app and takes about a minute, which no PR gate can afford.

```bash
pnpm lighthouse
pnpm --filter @vp/lighthouse test
```
