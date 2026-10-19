# Accessibility

The bar is WCAG 2.2 AA in every theme, mode and density, with axe clean on every story. The checklist form is
[README section 9](../README.md#9-the-polish-bar); this file is how each part is met.

## Contrast floors

| What | Floor | Where it is checked |
|---|---|---|
| Body and UI text | 4.5:1 | contrast gate over every theme, mode and pair ([color.md](color.md#enforced-contrast-pairs)) |
| Text at 24 px and up | 3:1 | advisory |
| Control outlines (`border-strong`), icons, focus ring, progress fill | 3:1 | contrast gate |
| `fg-muted` | 4.5:1 required; 7:1 in dark and OLED | gate, see the miss listed in color.md for light |
| `fg-subtle` | none: placeholders and disabled only | never carries information |
| Contrast setting "more" | the viewer's choice; raises `border` to `border-strong` and `fg-muted` to `fg`; pairs with the `bold` border set, which a viewer can also choose alone | story tagged `text` |

Colour is never the only signal: a warning has its icon, a live badge says LIVE, a selected item has a ground
and `aria-current`, a chart series has a label.

## Focus ring

| Property | Value |
|---|---|
| Role | `focus-ring` (Sand dark `#D2B076`, Sand light `#86683A`, Nocturne dark `#FFC266`, Nocturne light `#7A5216`) |
| Shape | solid outline at `border-focus` width and `border-focus-offset` (2 px and 2 px under `hairline` and `regular`, 3 px and 3 px under `bold`), following the element's radius |
| Trigger | `:focus-visible` only; a mouse click shows none |
| Count | exactly one ring per focused element: never a second ring from a field's own border |
| Ground | 3:1 against `bg` and `surface` in every mode (4.64 to 13.16 measured) |
| Fields | the ring plus a 3 px `accent-soft` halo (stand-in); border turns `focus-ring` |
| Over video | the ring sits on `scrim` chrome; a control on a bright frame still shows it because the chrome is a gradient to black |

Do not remove an outline without replacing it. Never hide the ring under reduced motion or on pointer devices.

## Keyboard map

Every action is reachable from the keyboard, focus order matches reading order, Escape closes what opened.
Shortcuts are suspended while focus is in an input, textarea or contenteditable (ticket 57).

| Key | Scope | Action |
|---|---|---|
| `/` | anywhere | open the command palette on search |
| `Cmd K` (`Ctrl K` elsewhere) | anywhere | open the command palette |
| `Escape` | any overlay | close it and return focus to its trigger |
| `Tab`, `Shift Tab` | page | move through controls in reading order |
| `Space` or `k` | player | play and pause |
| `j`, `l` | player | back 10 s, forward 10 s |
| Left, Right arrows | player or seekbar | back 5 s, forward 5 s |
| Up, Down arrows | player or volume | volume up and down, 5% per step |
| `m` | player | mute |
| `t` | player | theater mode |
| `f` | player | fullscreen (also double-click) |
| `i` | player | picture-in-picture |
| `,` and `.` | player, paused | step one frame back, forward |
| `0` to `9` | player | seek to 0 to 90% |
| Arrow keys, Home, End | menus, tabs, chip bars, shelves | move within the group (roving tabindex) |
| Enter, Space | any control | activate |

The palette list is a combobox: arrows move the active option, Enter runs it, Escape closes. Opened by
keyboard, it appears without animation ([motion.md](motion.md)).

## Target sizes

`layout.touch-target` is 44 px under `small` and `medium` sizing and 48 px under `large` (WCAG 2.5.5 level AAA,
adopted as the floor; the AA minimum is 24 px). It never drops below 44 px, so the compact density's smaller
controls (28, 36 and 44 px under `small`) still reach 44 px of hit area. The visible control may be smaller as
long as the hit area reaches it: the stand-in's 40 px buttons, 34 px chips and 32 px small buttons extend their
hit area with padding or a pseudo-element. Adjacent targets keep at least
`space-2` between hit areas. Pointer-only affordances (the card's "more" button, the expand panel) are also
reachable by keyboard and long-press.

## Reduced motion

Honour `prefers-reduced-motion` and the `motion` set. `prefers-reduced-motion: reduce` forces the `reduced` set
whatever the viewer or theme chose; the viewer can also choose `reduced` without the system setting, or `calm`
for the same moves slower and gentler. Under `reduced` only opacity moves; keyboard-opened surfaces never animate
at all; view transitions are skipped. The live dot is static and the `LIVE` label says it is live; nothing pulses. Full table: [motion.md](motion.md).

## Appearance levers

Several token sets are accessibility controls in their own right. They live in the Accessibility section of the
settings ([ticket 72](../../tickets/72-frontend-settings-customization-system.md)), beside contrast, and the
advanced appearance page lists every set. Each applies without a reload and every component must hold under the
whole range, which the visual matrix tests ([token-sets.md](token-sets.md)).

| Lever | Set and values | Helps with |
|---|---|---|
| Font size | `fontSize`: `small`, `default`, `large`, `xlarge` (body 14, 15, 17, 19 px) | low vision, reading comfort; `xlarge` is the stress test for every layout |
| Contrast | the contrast setting "more" (standard or more) | low vision; raises borders and muted text |
| Bold borders | `border`: `bold` (control 2 px, focus ring 3 px) | seeing where a field or card ends; a thicker focus ring |
| Larger controls | `sizing`: `large` (control `md` 44 px, touch target 48 px) | motor control, touch use |
| Calm motion | `motion`: `calm` | motion that feels busy |
| Reduced motion | `motion`: `reduced`, forced by `prefers-reduced-motion` | vestibular sensitivity, motion sickness |
| Ambient glow off | `ambient`: `off` | a moving, blurred glow behind the picture can distract or hurt; `off` removes it and the frame sampling |
| System fonts | `typography`: `system` | a face the viewer already reads easily; no font download |

Two rules follow. First, no lever is hidden behind another: choosing a theme never resets an accessibility
choice, because a viewer's overrides carry over a theme switch. Second, `prefers-reduced-motion` is the one
system setting that forces a set (`motion` to `reduced`); every other lever is the viewer's own choice.

## RTL

Logical properties only (`ps-`, `pe-`, `start-`, `end-`, `text-start`). The icons that point somewhere mirror;
the player's seekbar stays left to right (time runs the same way in every locale, and arrow keys keep the
expected direction), as do durations and timestamps (`dir="ltr"`). The workbench renders every story in RTL.

## Screen reader patterns

| Surface | Pattern |
|---|---|
| Video card | One link, the title, as the accessible name; byline, meta, duration and reason are inside it in reading order ("Shot entirely on a 1998 camcorder, Marta Reis Films, 18 minutes 42 seconds, 412 thousand views, 2 days ago"). Badges (4K, LIVE) read in text. The "more" and Save buttons are separate controls after the link |
| Progress on a card | `role="progressbar"` with `aria-valuenow` and a text "62% watched", not colour alone |
| Shelf | `section` labelled by its heading; the track is a list; chevrons are buttons ("Scroll shelf forward") and hidden when nothing scrolls; keyboard reaches every card by Tab |
| Chip bar | `role="toolbar"` or tablist with `aria-pressed` or `aria-selected`; the selected chip reads as selected |
| Player | the region is labelled with the video title; every control is a button with a name and `aria-pressed` state (Play, Mute, Captions, Theater); seekbar and volume are sliders; seekbar `aria-valuetext` reads "4 minutes 12 seconds of 18 minutes 42 seconds"; buffering and errors announce through a polite live region |
| Queue | a list; the current row has `aria-current="true"`; reorder by keyboard with a documented key pair (grip button focused, Space to lift, arrows to move, Space to drop) and a live announcement "Moved to position 3 of 12"; remove is a labelled button |
| Live chat | the message list is a log (`role="log"`, polite), new messages never steal focus; a "Jump to latest" button appears when scrolled up; the composer is labelled; overlay opacity slider is a named slider |
| Dialogs and sheets | focus moves in, is trapped, returns to the trigger; labelled by their title |
| Toasts | `role="status"`, polite; an error toast with an action is `role="alert"` and stays until dismissed |
| Skeleton | `aria-busy="true"` on the region, content not announced piecemeal |
| Now playing bar | a labelled region; its title and play state are announced on change |

## Captions

Captions are a first-class control: the `captions` button is always in the settings menu, a toggle with
`aria-pressed`, its state remembered. Caption text sits on a `scrim`-grounded box at 4.5:1 minimum, never on
raw video; size and background follow the viewer's setting. Live streams carry captions when the source has
them. Chapter titles and transcripts are text, not images.

## Do and don't

| Do | Don't |
|---|---|
| Give every icon-only control a name | Use a `title` attribute as the only name |
| Keep focus where the viewer was after a close | Drop focus to the document body |
| Announce async results in a live region | Move focus on an update |
| Test in all six theme and mode pairs, RTL, "more" contrast and `xlarge` font size | Pass axe in one theme only |
| Test the extremes of each set (`bold` border, `large` sizing, `reduced` motion, `ambient` off) | Check only the theme defaults |
