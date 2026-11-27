# Changelog

## 0.5.0

- Breaking: every formatter is a kind, `defineKind({ name, arg, options, render })`, and `createIntl(context, kinds?)`
  takes the registry (`formatKinds`, plus an app's own). `IntlBinding` is `{ context, format, call }`:
  `pluralCategory`, `collator` and `truncate` are kinds reached through `call`. `TaggedValue` is derived from the
  registry; `FORMAT_KINDS`, `FormatKind`, `KindsMatchUnion` and `formatValue` are removed, and `optionKeys` replaces
  `withOptions`. `money`'s `units`, `relative`'s and `calendarDay`'s `now` and `displayName`'s `of` are options.
- `createIntlCache(env)` takes the constructors as an `IntlEnvironment` (`Intl` by default);
  `cache.get(descriptor, locale, options)` builds whatever an `IntlDescriptor` describes.
- `KindContext`, `runKind` and `describeValue`, the last moved from `@kit/i18n`.
- `defineNumberKind` and `defineScaledUnitKind` build the number family (`bytes` and `bitrate` share one scaler);
  a default such as `percent`'s one decimal gives way to a caller's fraction or significant digits, so
  `{ minimumFractionDigits: 2 }` renders `7.00%` instead of declining.
- Breaking: `date`, `time`, `dateTime` (and every kind reading an instant) decline a calendar date such as
  `2024-05-01`; the new `plainDate` kind formats it with no zone. `dateFormatOptions` is replaced by
  `resolveDateOptions`.
- `relative` rounds half away from zero and reads a count that rounds up to the next unit in that unit:
  3570 seconds is "in 1 hour" and "1 hour ago".
- Breaking: a preset's locale entry overrides part of `default` instead of replacing it.

## 0.4.0

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
