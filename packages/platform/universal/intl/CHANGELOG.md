# Changelog

## 0.4.0

- Breaking: the `User` type is removed; `USER` stays. `resolveCurrency`'s `requested`, `DisplayNameValue.value` and the money formatter's `currency` are typed `string`: the `User` member of the union was already absorbed by `string`, so no accepted value changes, and nothing else used the type.
- `Preset`, `PresetTable`, `definePresets` and `resolveEntry`, moved from `@kit/i18n`.

## 0.3.0

- Breaking: `SUPPORTED_LOCALES` and `FALLBACK_LOCALE` are removed; the app registers its locales with the new
  `defineLocales({ source, details })`. `localeChain` ends at the tag's language and no longer appends `en`: the
  caller appends its own source locale.

## 0.2.0

- `FormatErrorCodes` exports the four `FORMAT_*` codes this package emits; the app spreads it into its error
  code set instead of repeating them. The failure types are typed from it.

## 0.1.0

- First release: the public API recorded in api/intl.api.txt.
