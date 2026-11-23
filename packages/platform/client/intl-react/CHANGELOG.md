# Changelog

## 0.3.0

- Breaking: `useT`, `IntlRegister` and `RegisteredTranslator` are removed, and `IntlProvider` no longer takes
  `createTranslator`. `createReactI18n(i18n)` returns a `TranslatorProvider` and a `useT` typed by the catalogue the
  app registered with `@kit/i18n`, each call its own context, so two apps' catalogues never meet in one type.

## 0.2.0

- Breaking: `IntlProvider` takes `clock` and `createTranslator` (the app builds its translator, so the package no longer imports an app's messages); the translator type `useT` returns is the app's, declared by merging into `IntlRegister`.
- Breaking: `createLocaleStore` takes `{ fallbackLocale, load }` and is generic over the app's locale and catalogue types; `FALLBACK_ACTIVE_LOCALE` is replaced by `fallbackActiveLocale(locale)`.

## 0.1.1

- No API change: the snapshot is now recorded from this package's own program, so other packages no longer reorder or widen its types.

## 0.1.0

- First release: the public API recorded in api/intl-react.api.txt.
