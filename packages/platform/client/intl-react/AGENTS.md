# AGENTS.md — @kit/intl-react (The Browser Binding for Formatting & Messages)

Instructions for any coding agent working on `@kit/intl-react`.

> Tier rules for this directory: [../AGENTS.md](../../../client/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

`IntlProvider`, `useFormat`, `<Format>` and `createReactI18n`: the React face of `@kit/intl` and `@kit/i18n`.
`client` tier. It names no app: the app hands it its `I18n` (from `@kit/i18n`'s `createI18n<AppCatalogue>()`), a clock and a catalogue loader. Small on purpose: everything that can be pure lives in the two universal packages.

---

## 2. Invariants

1. **The locale is told, never detected.** `IntlProvider` takes the negotiated `locale` as a required
   prop. The negotiation chain and the only `navigator.languages` read live in the app's
   request-locale module (`tests/architecture/single-locale-source.test.ts`). `browser-environment.ts` reads
   the runtime time zone and the clock the app passes, nothing else.
2. **The app owns the translator.** `createReactI18n(i18n)` returns a `TranslatorProvider` (it builds the
   translator over the binding of the `IntlProvider` above it and the `catalogues` it is handed) and a `useT`
   typed by the app's catalogue. Each call has its own context, so two catalogues (two apps, or an app and a
   shared layer) never merge into one type and no declaration merging is needed. No locale list, source
   catalogue or message type is written here.
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
