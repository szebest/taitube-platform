# AGENTS.md — @kit/intl-react (The Browser Binding for Formatting & Messages)

Instructions for any coding agent working on `@kit/intl-react`.

> Tier rules for this directory: [../AGENTS.md](../../../client/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

`IntlProvider`, `useT`, `useFormat` and `<Format>`: the React face of `@kit/intl`.
`client` tier, layer T6. It names no app: the app hands it a translator builder, a clock and a catalogue loader. Small on purpose: everything that can be pure lives in the two universal packages.

---

## 2. Invariants

1. **The locale is told, never detected.** `IntlProvider` takes the negotiated `locale` as a required
   prop. The negotiation chain and the only `navigator.languages` read live in the app's
   request-locale module (`tests/architecture/single-locale-source.test.ts`). `browser-environment.ts` reads
   the runtime time zone and the clock the app passes, nothing else.
2. **The app owns the translator.** `IntlProvider` takes `createTranslator(intl)` and `clock`; the translator's
   type is the app's, declared once by merging into `IntlRegister`
   (`declare module '@kit/intl-react' { interface IntlRegister { translator: AppTranslator } }`), which is what
   `useT` returns. No locale list, source catalogue or message type is written here.
3. **One catalogue per visitor.** `createLocaleStore({ fallbackLocale, load })` (one per router) loads the active
   locale's catalogue through the app's `load`, a dynamic import for every language but the fallback, and its
   snapshot is what the provider renders. It is generic over the app's locale and catalogue types. A server
   render passes `timeZone` and `now` too, so the hydration renders the same text.
4. **Hooks fail loudly outside the provider**, naming it.

---

## 3. Testing

The `.test.tsx` specs render with Testing Library under jsdom. Like every `packages/client/` package this one
is browser-only, so `pnpm test:bun` leaves it out.

```bash
pnpm --filter @kit/intl-react typecheck
pnpm --filter @kit/intl-react test
```
