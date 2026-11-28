# Changelog

## 0.3.0

- `./contract` exports `describeAppearanceContract`, `AppearanceSubject` and `MakeAppearance`; vitest is a peer.

## 0.2.0

- `InvalidDefinition` and `InvalidColour` take `VALIDATION_FAILED` from `CommonErrorCodes` in `@kit/errors`;
  the package no longer imports the app's error codes. The wire value is unchanged.
- `MODE_OPTIONS`, `ModeOption`, `CONTRAST_OPTIONS` and `ContrastOption` moved to `@kit/appearance`, which the theme schema now takes them from; import them from there.

## 0.1.1

- No API change: the snapshot is now recorded from this package's own program, so other packages no longer reorder or widen its types.

## 0.1.0

- First release: the public API recorded in api/design-tokens.api.txt.
