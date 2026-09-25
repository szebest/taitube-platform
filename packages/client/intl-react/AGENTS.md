# AGENTS.md — @vp/intl-react (The Browser Binding for Formatting & Messages)

Instructions for any coding agent working on `@vp/intl-react`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

`IntlProvider`, `useT`, `useFormat` and `<Format>`: the React face of `@vp/intl` and `@vp/messages`.
`client` tier, layer T4. Small on purpose: everything that can be pure lives in the two universal packages.

---

## 2. Invariants

1. **Detection lives here and nowhere else.** `browser-environment.ts` is the one module that reads the
   saved locale, `navigator.languages`, the runtime time zone and the clock. `resolve-locale.ts` is the pure
   order: explicit prop, saved preference, browser languages, `en`.
2. **Bindings are built once per locale.** The provider memoises the `IntlBinding`, the `Translator` and a
   fresh `IntlCache` on locale, zone, currency, reference instant and catalogues; a re-render with the same
   props reuses them.
3. **A server render passes its context in.** `locale`, `timeZone` and `now` props make the hydration
   render the same text; without them the provider reads the browser, which is right for today's CSR app.
4. **Hooks fail loudly outside the provider**, naming it.

---

## 3. Testing

The `.test.tsx` specs render with Testing Library under jsdom, which Bun does not ship, so `pnpm test:bun`
skips exactly those; `resolve-locale.test.ts` runs under both.

```bash
pnpm --filter @vp/intl-react typecheck
pnpm --filter @vp/intl-react test
```
