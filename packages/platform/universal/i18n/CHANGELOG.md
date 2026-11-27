# Changelog

## 0.3.0

- Breaking: a placeholder kind is a `@kit/intl` kind with its requirement, `messageKind(kind, 'optional' | 'required')`.
  `defineKind`, `Kind`, `KindContext` and `Rendered` are removed and `describeValue` moves to `@kit/intl`;
  `numberKind`, `dateKind` and `listKind` are `@kit/intl`'s `number`, `date` and `list`. A kind composes another
  through `context.format`, which resolves presets the way a config entry does.
- A preset's locale entry types as part of its kind's options, laid over `default`; an option the kind does not
  take fails to compile in any entry.

## 0.2.0

- `Preset`, `PresetTable`, `definePresets` and `resolveEntry` move to `@kit/intl`; `FormatPresets` stays.
- `./contract` exports `describeI18nContract`, `I18nSubject` and `MakeI18nSubject`; vitest is a peer.

## 0.1.0

- First release: the public API recorded in api/i18n.api.txt.
