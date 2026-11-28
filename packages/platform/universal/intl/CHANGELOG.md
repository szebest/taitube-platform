# Changelog

## 0.6.0

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
- Options added to the kinds that had room for them: `roundingMode`, `trailingZeroDisplay` and significant digits on
  `number`; `roundingMode` and `signDisplay` on `count`; `input: 'fraction'`, `roundingMode` and
  `maximumSignificantDigits` on `percent`; `currencySign`, `notation`, `trailingZeroDisplay` and an exact decimal
  `units: 'minor'` on `money` (a fractional minor amount is declined); `minimumFractionDigits`, `roundingMode` and
  `minUnit` on `bytes` and `bitrate`; `timeZone` and `calendar` per value on `date`, `time` and `dateTime`,
  `fractionalSecondDigits` on `time`, independent `dateStyle` and `timeStyle` on `dateTime` and time fields on
  `dateRange`; `withTime`, `style` and `windowDays` on `calendarDay`; `minUnit`, `maxUnit`, `thresholds` and calendar
  months and years on `relative`; `style` and `languageDisplay` on `displayName`; `usage` on `collator`; `ellipsis`,
  `position` and `boundary` on `truncate`; `unit`, `maxUnits` and `hoursDisplay` on `duration`. `numberRange` takes two
  values of one kind (`number`, `count`, `percent`, `money`) and a number kind's `input` is the `NumberInput` it hands `Intl.NumberFormat`.
- Breaking: a preset's locale entry overrides part of `default` instead of replacing it.
- `list` formats each item through its context (text, numbers, tagged values, or raw values of `item: { kind }`),
  collapses past `max` into the caller's plural `more` branches (no copy of its own; `max` without `more` fails
  to compile and declines), and its `parts`, through `runParts`, return a `ListDetail`. A kind may define
  `parts` beside `render`.
- `duration` takes `days` (whole days instead of 24-hour hours) and the fallback renders them; the fallback is held to
  the native `Intl.DurationFormat` over 17 locales, 6 option sets and 6 durations.
- New kinds `initials`, `capitalize`, `timeZone` and `isolate`, in `formatKinds`, and `parseDecimal(text, context)`, which
  reads a typed number by the locale's grouping, decimal and numerals and returns a `Result`.

## 0.4.0

- Breaking: the `User` type is removed; `USER` stays. `resolveCurrency`'s `requested`, `DisplayNameValue.value` and the money formatter's `currency` are typed `string`: the `User` member of the union was already absorbed by `string`, so no accepted value changes, and nothing else used the type.
- `Preset`, `PresetTable`, `definePresets`, `resolveEntry` and the `FormatPresets` token, moved from `@kit/i18n`;
  `@kit/di` is a dependency and the package moves to layer T3.

## 0.3.0

- Breaking: `SUPPORTED_LOCALES` and `FALLBACK_LOCALE` are removed; the app registers its locales with the new
  `defineLocales({ source, details })`. `localeChain` ends at the tag's language and no longer appends `en`: the
  caller appends its own source locale.

## 0.2.0

- `FormatErrorCodes` exports the four `FORMAT_*` codes this package emits; the app spreads it into its error
  code set instead of repeating them. The failure types are typed from it.

## 0.1.0

- First release: the public API recorded in api/intl.api.txt.
