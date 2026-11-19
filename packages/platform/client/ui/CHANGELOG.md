# Changelog

## 0.2.0

- `InvalidTheme` and `ThemeNotInstalled` take `VALIDATION_FAILED` and `INTERNAL` from `CommonErrorCodes` in
  `@kit/errors`; the package no longer imports the app's error codes. The wire values are unchanged.
- `accountAppearance` and `appearanceFromAccount` speak `AccountAppearance`, the account's shape derived from `AppearancePreference`, and the cookie's defaults and options come from `@kit/appearance`.
- `PlatformIcon` takes a `PlatformIconName` (a vendored brand mark or `website`), and `PLATFORM_ICON_NAMES` lists them; the app's own link platforms must fit it.

## 0.1.1

- No API change: the snapshot is now recorded from this package's own program, so other packages no longer reorder or widen its types.

## 0.1.0

- First release: the public API recorded in api/ui.api.txt.
