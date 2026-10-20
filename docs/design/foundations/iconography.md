# Iconography

Summary in [README section 6](../README.md#6-mark-and-icons). The inventory below is the set drawn in
[`lib/icons.svg`](../lib/icons.svg); the product renders them through the `Icon` primitive over `lucide-react`
([ticket 95 section 3](../../tickets/95-design-system-2.md)).

## Spec

| Property | Value |
|---|---|
| Family | Lucide, one family for the whole product (the stand-in redraws the same shapes by hand) |
| Grid | 24 x 24 viewBox, scaled to the rendered size |
| Stroke | 1.75, round caps, round joins, `currentColor`, no fill |
| Sizes | `IconSize` `sm`, `md`, `lg` from the `sizing` set (16, 20, 24 px at `medium`), set by the `Icon` primitive |
| Colour | inherits `currentColor`: `fg-muted` at rest, `fg` on hover, `accent-ink` when active |
| Accessibility | `aria-hidden` unless the icon carries the meaning alone, then it takes a label |

Strokes do not scale with size: the stroke stays 1.75 in the 24 px drawing, so it renders thinner at 16 and
thicker at 24. Use the `Icon` primitive and never override `stroke-width` per use.

## Sizes

Icons come in three sizes, the `IconSize` keys of the `sizing` set: `size-icon-sm`, `size-icon-md` and
`size-icon-lg`. The pixel values follow the viewer's sizing choice:

| `IconSize` | `small` | `medium` (default) | `large` |
|---|---|---|---|
| `sm` | 14 px | 16 px | 18 px |
| `md` | 18 px | 20 px | 22 px |
| `lg` | 22 px | 24 px | 26 px |

The rest of this file names the `medium` pixel values (16, 20, 24) for readability; in code a component asks for
`sm`, `md` or `lg`, never a number. The icon scales with its control, so the ratio of icon to control stays the
same at every sizing choice.

| Size | Used for |
|---|---|
| 16 (`sm`) | inline with `caption` or `body-sm` text, badges, the reason label, chips' leading icon, status icons beside `warning-ink` text, the byline |
| 20 (`md`) | the default: buttons, nav and rail items, tab bar, menu rows, field adornments, player chrome controls |
| 24 (`lg`) | icon-only primary controls (IconButton, header actions), the play button, empty-state glyphs where the illustration is not used |

An icon sits inside a `control-md` (40 px at `medium`) with at least a 44 px hit area (`touch-target`); the icon size does not grow to fill it.
Never mix sizes within one row of actions.

## Active and selected states

| State | Treatment |
|---|---|
| Rest | `fg-muted` icon, no ground |
| Hover | `fg` icon, `tint` ground |
| Active or selected | `accent-soft` ground, `accent-ink` icon, label `fg` at a heavier weight; the rail also sets `aria-current="page"` |
| Pressed toggle (Save, Like) | same ground and ink, plus `aria-pressed="true"` |
| Disabled | `fg-subtle`, `tint` ground, no hover |

Never swap to a filled variant to show active: a filled Like and an outlined Like are two different icons in
other systems, here the ground and ink change and the glyph does not. The few glyphs with filled dots (`more`,
`grip`, `tag`) are drawn that way and do not toggle. `verified` is a deliberate filled badge, an exception
because it is a status mark, not a control.

## Icon and label

| Rule | Detail |
|---|---|
| Navigation always has a label | rail, tab bar and menu items show icon and text; the collapsed rail shows a 10 px label under the icon |
| Icon-only is for known controls | play, volume, fullscreen, close, more: each takes a tooltip and an accessible name |
| Gap | 8 px between icon and label inside a button, 16 px in a rail row |
| Order | icon at the inline start, label after; reverse only for a trailing chevron (`chevron-right`, `chevron-down`) |
| Direction | icons that imply direction (`chevron-*`, `next`, `prev`, `share`) mirror in RTL; icons of objects (`play`, `clock`, `like`) do not |
| One icon, one meaning | `like` always means like, `heart` never does (see inventory) |

## Inventory

Every id in `lib/icons.svg` (65), what it draws and where Taitube uses it. `@vp/ui`'s `src/icons/inventory.tsx`
maps each one but `mark` to its Lucide glyph, or to a glyph of its own for the filled `more`, `more-h`, `grip` and
`verified`, and a spec holds the map to the sprite.

| Group | Id | Meaning in the product |
|---|---|---|
| Navigation | `menu` | opens and collapses the rail |
| | `search` | search field and the compact header action |
| | `home` | Home |
| | `shorts` | Shorts (a 9:16 frame with a play triangle) |
| | `following` | Subscriptions (the feed of subscribed channels) |
| | `live` | Live (broadcast waves) |
| | `explore` | Explore (a compass), the browse shelf |
| | `you` | You and the account fallback |
| | `history` | History |
| | `clock` | Watch later |
| | `playlist` | Playlists |
| | `video` | Your videos |
| Create | `plus` | Create, add |
| | `upload` | Upload a video |
| | `bell` | notifications |
| | `settings` | settings |
| | `sun`, `moon` | theme mode in the palette and the appearance switcher |
| Player | `play`, `pause` | play and pause |
| | `next`, `prev` | next and previous in the queue |
| | `volume` | volume and mute |
| | `captions` | captions toggle |
| | `theater` | theater mode |
| | `fullscreen` | fullscreen |
| | `expand` | expand the now playing bar back to the watch page |
| Engagement | `like`, `dislike` | the engagement bar pair |
| | `share` | Share |
| | `save` | Save to Watch later or a playlist |
| | `queue-add` | Add to queue |
| | `clip` | Clip (scissors) |
| | `heart` | appreciation outside the Like count, such as a creator's heart on a comment |
| | `chat` | live chat and Discussion |
| | `pin` | a pinned comment or a pinned Start here shelf |
| | `flame` | trending and popular reasons |
| Controls | `more` | overflow menu on a card (vertical) |
| | `more-h` | overflow menu in a toolbar (horizontal) |
| | `chevron-right`, `chevron-left`, `chevron-down` | shelf scroll, disclosure, expand |
| | `check` | selected menu item, success |
| | `close` | dismiss |
| | `shuffle`, `repeat` | queue controls |
| | `grip` | drag handle on a queue row |
| | `filter`, `sort` | list and table controls |
| | `command` | the Cmd key in the palette hint |
| Studio | `chart` | analytics |
| | `layout` | content layout and customisation |
| | `shield` | moderation and admin |
| | `tag` | tags and categories |
| | `eye`, `eye-off` | visibility, show and hide |
| | `lock`, `globe` | private, public |
| | `trash`, `edit` | delete, edit |
| Status | `alert` | warning and error, always beside `warning-ink` or `danger-ink` text |
| | `info` | information, beside `info-ink` text |
| | `wifi-off` | the offline state |
| | `verified` | a verified channel (filled badge) |
| Brand | `mark` | the Taitube mark: a 16:9 frame with a rising sun, 32 x 22, stroke 3 |

`mark` is not a UI icon: it is the logo, one ink, `accent` in the header and `fg` elsewhere, and does not use
the 1.75 stroke or the three sizes. A success status uses `check`, which has no dedicated glyph of its own.

## Labelling

| Case | Markup |
|---|---|
| Decorative, text beside it | `aria-hidden="true"` |
| Icon-only button | the button carries `aria-label` ("Add to queue"); the icon stays `aria-hidden` |
| Toggle | `aria-label` stays constant and `aria-pressed` carries the state: "Save", not "Saved" |
| Status icon next to text | decorative; the text states the status |
| Icon that conveys meaning alone, no button | `role="img"` and `aria-label` |
| Tooltip | on every icon-only control, same text as the label, never the only label |

Labels are sentence case verbs from the message catalogue ([voice-and-copy.md](voice-and-copy.md)) and never
the icon's file name.

## Do and don't

| Do | Don't |
|---|---|
| Add an icon from Lucide through `Icon` | Draw or import a one-off SVG |
| Reuse one id for one meaning | Use `heart` and `like` interchangeably |
| Show active with ground and ink | Swap to a filled icon |
| Use `IconSize` `sm`, `md`, `lg` | Scale an icon to 18 px to "fit" |
| Leave `bootstrap-icons` behind (it leaves with ticket 62) | Add a new `bi-*` class |
