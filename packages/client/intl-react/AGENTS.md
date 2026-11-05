# AGENTS.md — @vp/intl-react (The Browser Binding for Formatting & Messages)

Instructions for any coding agent working on `@vp/intl-react`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

`IntlProvider`, `useT`, `useFormat` and `<Format>`: the React face of `@vp/intl` and `@vp/messages`.
`client` tier, layer T4. Small on purpose: everything that can be pure lives in the two universal packages.

---

## 2. Invariants

1. **The locale is told, never detected.** `IntlProvider` takes the negotiated `locale` as a required
   prop. The negotiation chain and the only `navigator.languages` read live in `@vp/queries`'
   `request-locale.ts` (`tests/architecture/single-locale-source.test.ts`). `browser-environment.ts` reads
   the runtime time zone and the clock, nothing else.
2. **Bindings are built once per locale.** The provider memoises the `IntlBinding`, the `Translator` and a
   fresh `IntlCache` on locale, zone, currency, reference instant and catalogues; a re-render with the same
   props reuses them.
3. **One catalogue per visitor.** `createLocaleStore()` (one per router) loads the active locale's catalogue
   through `LOCALE_DETAILS` in `@vp/messages`, a dynamic import for every language but `en`, and its
   snapshot is what the provider renders. A server render passes `timeZone` and `now` too, so the hydration
   renders the same text.
4. **Hooks fail loudly outside the provider**, naming it.

---

## 3. Testing

The `.test.tsx` specs render with Testing Library under jsdom. Like every `packages/client/` package this one
is browser-only, so `pnpm test:bun` leaves it out.

```bash
pnpm --filter @vp/intl-react typecheck
pnpm --filter @vp/intl-react test
```
