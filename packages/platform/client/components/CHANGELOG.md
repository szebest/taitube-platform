# Changelog

## 0.5.0

- Breaking: `AccountMenu.Trigger`, `ActingAs.Avatar` and `IdentityRow.Avatar` take `initials` instead of `name`: the caller renders the `initials` kind of `@kit/intl`, so the monogram follows the viewer's language and whole graphemes.

## 0.4.0

- `TimelineRangeEditor`, `TimelineControl`, `RangeControl`, `PositionControl`, `TimelineMarker` and `TimelineRange`: a range or a position over a video's frames, moved from the studio's kit since web draws it too.

## 0.3.0

- `SpriteStrip`, `spriteFrameStyle`, `SpriteSheet` and `SpriteStripShade`: the frames of a video side by side from its thumbnail sprite sheet, with an optional shade outside a range.

## 0.2.0

- `IdentityRow`, `ActingAs` and `IdentitySwitcher`: the identity switcher parts, with `IDENTITY_ITEM`, `jumpToIdentityItem` and `useIdentityRow`.

## 0.1.0

- First release: the public API recorded in api/components.api.txt.
