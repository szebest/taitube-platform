# Changelog

## 0.5.0

- `MoreDisclosure`: inline text that opens a popover on click, tap, keyboard focus and a resting mouse (`pointerType`
  mouse only, after `openDelay`), and closes on Escape, an outside press, blur and the mouse leaving. It prints no
  words: its trigger text and content come from the caller.

## 0.3.0

- Breaking: `UI_COPY_KEYS` (and so `UiCopy`) holds only the 45 words this package and the other kit packages
  render themselves; the 97 words only an app's own components read are gone, and the app renders them from its
  catalogue.

## 0.2.0

- `ICONS`, the icon ids with the glyph that draws each, is exported, so an app can check its design library
  against what the package draws.
- `InvalidTheme` and `ThemeNotInstalled` take `VALIDATION_FAILED` and `INTERNAL` from `CommonErrorCodes` in
  `@kit/errors`; the package no longer imports the app's error codes. The wire values are unchanged.
- `accountAppearance` and `appearanceFromAccount` speak `AccountAppearance`, the account's shape derived from `AppearancePreference`, and the cookie's defaults and options come from `@kit/appearance`.
- `PlatformIcon` takes a `PlatformIconName` (a vendored brand mark or `website`), and `PLATFORM_ICON_NAMES` lists them; the app's own link platforms must fit it.

## 0.1.1

- No API change: the snapshot is now recorded from this package's own program, so other packages no longer reorder or widen its types.

## 0.1.0

- First release: the public API recorded in api/ui.api.txt.
