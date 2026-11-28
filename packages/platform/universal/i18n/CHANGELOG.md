# Changelog

## 0.4.0

- Breaking: a placeholder kind is a `@kit/intl` kind with its requirement, `messageKind(kind, 'optional' | 'required')`.
  `defineKind`, `Kind`, `KindContext` and `Rendered` are removed and `describeValue` moves to `@kit/intl`;
  `numberKind`, `dateKind` and `listKind` are `@kit/intl`'s `number`, `date` and `list`. A kind composes another
  through `context.format`, which resolves presets the way a config entry does.
- A preset's locale entry types as part of its kind's options, laid over `default`; an option the kind does not
  take fails to compile in any entry.
- `{names:list}` takes `type`, `style`, `max`, `more` and `item` in its config; `item: { kind }` types the argument
  as that kind's values. `Translator.parts(key, args)` returns the message as `MessagePart`s, a list keeping its
  `ListDetail`; joined, they are what `t` returns. `Translator.partsOr(key, args, fallback)` is
  `parts` with `tOr`'s positional arguments.

## 0.2.0

- Breaking: `Preset`, `PresetTable`, `definePresets`, `resolveEntry` and the `FormatPresets` token move to
  `@kit/intl`, which re-exports none of them here. The package moves to layer T4.
- `./contract` exports `describeI18nContract`, `I18nSubject` and `MakeI18nSubject`; vitest is a peer.

## 0.1.0

- First release: the public API recorded in api/i18n.api.txt.
