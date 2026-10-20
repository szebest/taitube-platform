# Motion

Summary in [README section 5](../README.md#5-shape-space-elevation-motion); the build is
[ticket 95 section 7](../../tickets/95-design-system-2.md). Values are the `motion` token set (`set.motion`) in
[`tokens.json`](../tokens.json). Motion is quiet in the chrome and real in a few cinematic moments (README
principle 5).

## The three sets

A theme names a default (both Sand and Nocturne start on `standard`); the viewer can pick another in the
accessibility settings. The roles below are the same in every set, only the numbers change, so a component never
knows which set is active. The CSS variables are `--duration-<name>` and `--ease-<name>`
([token-sets.md](token-sets.md)).

| Set | Character | Who it is for |
|---|---|---|
| `standard` | the reference timings | everyone by default |
| `calm` | slower and gentler, the same moves | viewers who find motion busy but still want it |
| `reduced` | opacity only: every move is a short cross-fade, the shortest two durations are 0 ms | forced by `prefers-reduced-motion: reduce`, or chosen |

`prefers-reduced-motion` always wins: it selects `reduced` whatever the viewer picked or the theme says, and the
viewer's own choice resumes when the system setting is off. Accessibility settings show the system setting as
the reason when it is active ([accessibility.md](accessibility.md)).

## Tokens

| Duration | `standard` | `calm` | `reduced` | Use |
|---|---|---|---|---|
| `instant` | 80 ms | 100 ms | 0 ms | press feedback |
| `fast` | 140 ms | 200 ms | 0 ms | hover, focus, toggles |
| `base` | 220 ms | 320 ms | 120 ms | menus, tooltips, chips, background and colour changes |
| `slow` | 360 ms | 480 ms | 160 ms | sheets, dialogs, the card lift |
| `cinematic` | 560 ms | 720 ms | 200 ms | route view transitions, thumbnail to stage, the theme cross-fade |

| Easing | `standard` | `calm` | `reduced` | Use |
|---|---|---|---|---|
| `standard` | cubic-bezier(0.2, 0, 0, 1) | cubic-bezier(0.2, 0, 0, 1) | cubic-bezier(0, 0, 1, 1) | state changes in place: colour, fill, a toggle |
| `enter` | cubic-bezier(0.05, 0.7, 0.1, 1) | cubic-bezier(0.05, 0.7, 0.1, 1) | cubic-bezier(0, 0, 1, 1) | anything appearing: menus, sheets, toasts |
| `exit` | cubic-bezier(0.3, 0, 0.8, 0.15) | cubic-bezier(0.3, 0, 0.8, 0.15) | cubic-bezier(0, 0, 1, 1) | anything leaving; use a duration one step shorter than its enter |
| `settle` | cubic-bezier(0.2, 0.8, 0.2, 1) | cubic-bezier(0.25, 0.6, 0.2, 1) | cubic-bezier(0, 0, 1, 1) | lift and shared-element moves: lands without overshoot |

`reduced` uses a linear curve throughout, so there is no easing character left to tune. `calm` differs from
`standard` only in longer durations and a slightly softer `settle`.

Tailwind utilities are `duration-fast`, `ease-settle` and so on; a raw millisecond or a `transition-all` is a
review failure. Animate `transform` and `opacity` only, so nothing re-lays out.

## Catalogue

Every motion in the product. Timings are the roles above, so `calm` stretches them and `standard` is the
reference. "Reduced" is what happens under the `reduced` set (`data-motion="reduced"`), chosen by the viewer or
forced by `prefers-reduced-motion`.

| Motion | Trigger | Property | Duration | Easing | Reduced |
|---|---|---|---|---|---|
| Press | pointer down on a button | transform scale 0.97 | `instant` | `standard` | none |
| Hover and focus colour | pointer enter, focus | background, colour, opacity | `fast` | `standard` | instant swap |
| Toggle (switch thumb, chip fill) | click | inset position, background | `fast` | `settle` for the thumb, `standard` for the fill | instant swap |
| Card hover lift | pointer enter on a card (fine pointer) | thumbnail translateY -2 px, elevation 2 | `slow` | `settle` | none: elevation changes with no movement |
| Expand on hover | pointer rests 500 ms on a card, pointer devices only, cancelled on leave | card grows in place into a raised panel, preview and actions fade in | `slow` after the 500 ms delay | `settle`, content `enter` | panel appears with an opacity fade |
| "More" button on a card | hover or focus-within | opacity 0 to 1 | `fast` | `standard` | opacity (allowed) |
| Menu, popover, tooltip enter | click or hover (pointer); never from a keyboard shortcut | opacity, translateY of a few px | `base` | `enter`, leave with `exit` | opacity only |
| Dialog and sheet | open | opacity of scrim, sheet translate from its edge | `slow` | `enter`, leave with `exit` | opacity only |
| Toast | event | opacity and translate | `base` | `enter` | opacity only |
| Route view transition | navigation | cross-fade of the old and new view | `cinematic` | `standard` | none: instant navigation |
| Thumbnail to stage | open a video from a card (view transition, `view-transition-name` from the video id) | position and size of the thumbnail morph into the stage | `cinematic` | `settle` | none |
| Theme cross-fade | the viewer switches theme or mode | whole-page cross-fade through the View Transitions API | `cinematic` | `standard` | none: instant swap |
| Live pulse | live badge, live dot, always while live | opacity 1 to 0.35 and back, 1.6 s loop (stand-in) | loop | ease in out | static dot and the `LIVE` label, no animation |
| Skeleton shimmer | while loading | background position sweep, 1.4 s linear loop (stand-in) | loop | linear | static `tint` fill, no sweep |
| Ambient glow | new video frame sample | opacity and colour of a blurred layer, sampled at 10 to 15 fps | continuous | linear | static glow from the poster |
| Chip bar, shelf scroll | wheel, drag, chevron | scroll with snap | native | native | native (not a transition) |

Fallback where the View Transitions API is missing: the existing `data-theme-switching` pause (transitions are
disabled for one frame) so a theme change does not animate half the colours.

## Library-wide motion

| Motion | Where | Tokens | Under `reduced` |
|---|---|---|---|
| Sliding selection indicator | `SegmentedControl` thumb, `Tabs` underline, single-select `ChipGroup` pill | `duration-base`, `ease-settle` | jumps into place |
| Overlay entrance: fade and 4 px lift, scale from 0.98 | menus, popovers, hover cards, tooltips, dialogs | `duration-base`, `ease-enter` | fade only |
| Toast entrance: rise 12 px | toasts | `duration-slow`, `ease-enter` | fade only |
| Scrim fade | behind dialogs and sheets | `duration-base`, `ease-standard` | fade (already motionless) |
| Route cross-fade and shared element | every navigation; the thumbnail to the stage | `duration-cinematic`, `ease-standard` | none |

### Reduced motion, precisely

`reduced` is a motion set, so it is reached two ways that end in the same place: the viewer picks it (the
switcher, the settings area's Accessibility page), or the system asks for it (`prefers-reduced-motion`), which
forces it whatever the viewer picked. Under it:

- Nothing moves: no slide, lift, scale, parallax, pulse, shimmer or smooth scroll. Transitions are limited to
  opacity and colour, so a state change is still visible.
- Overlays and toasts fade in over `duration-base`; skeletons are a static `tint`; the live dot is a static dot beside
  the `LIVE` label, with no animation at all (the label, not the pulse, says it is live).
- View transitions are off; a navigation swaps the page at once.
- Video autoplay previews (expand on hover, the Shorts feed) start paused until the viewer plays them.
- `calm` is the middle ground for viewers who want motion but less of it: the same moves, longer and gentler.

## Rules

1. **A keyboard-driven open never animates.** The command palette (`/`, `Cmd K`), the shortcuts sheet and any
   surface opened by a shortcut appear in one frame. The same menu opened by pointer animates; opened from the
   keyboard (Enter on its trigger) it does not.
2. **Reduced motion allows opacity and nothing else.** Under `reduced` the instant and fast durations are 0 ms,
   so a press or hover swaps in one frame. No translate, scale, parallax, slide or morph, and no loop: the live
   dot is static and the `LIVE` label carries the meaning (README section 8).
3. **Entering uses `enter`, leaving `exit`, moving `settle`.** An exit is a step faster than its enter
   (`slow` in, `base` out).
4. **No layout shift on hover.** The lift moves the thumbnail by transform; the card's box and its neighbours
   never move.
5. **Respond within one frame.** Press and hover start immediately; do not delay a hover feedback. The one
   deliberate delay is the 500 ms expand, which is intent detection, not feedback.
6. **One cinematic thing at a time.** A route change with a shared element does not also run a card lift.
7. **Never loop decoration.** The only infinite loops are the live pulse and the skeleton; a spinner is a
   `Spinner` with a visible label, and stops under reduced motion into a static ring with text.

## Do and don't

| Do | Don't |
|---|---|
| `transition: transform var(--duration-slow) var(--ease-settle)` | `transition: all 0.3s ease` |
| Cancel the expand timer on pointer leave and on scroll | Expand a card under a touch tap |
| Ship each motion with a story that plays it in reduced mode | Test motion only at full |
| Fade scrims and overlays | Slide a scrim |

## Stand-in notes

[`lib/design.css`](../lib/design.css) turns off every animation and transition under
`prefers-reduced-motion`, which includes the live pulse; the product does the same (rule 2). The stand-in
also has no expand-on-hover, view transition or sheet motion: those are specified here and built in 95's components PR (r3).
