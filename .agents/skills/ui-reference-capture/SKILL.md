---
name: ui-reference-capture
description: >-
  Measuring an outside UI as reference for our own design: sizes, spacing, type and timing
  recorded as numbers with chrome-devtools-axi. Use before matching a layout, density or
  motion to another product, and when a spec says "like X" without values.
---

# UI reference capture

Reference means numbers, not material. Record what a surface measures and how it moves, then
build it from our tokens ([docs/design/README.md section 10](../../../docs/design/README.md#10-borrowing)).
Local-first holds: the capture runs in a browser on your machine and writes nothing into the repo
but the numbers.

## Steps

1. **Open the surface** at a fixed viewport, so numbers compare: `npx -y chrome-devtools-axi open <url>`,
   then `resize 1440 900`, and again at `390 844` for the phone layout. Sign-in walls and consent
   dialogs are out of scope: capture only what a signed-out visitor sees.
2. **Measure with `eval`**, one element per call, from `getBoundingClientRect()` and
   `getComputedStyle()`. Read width, height, padding, margin, gap, border-radius, font-size,
   line-height, font-weight, letter-spacing and the computed colour's lightness only if the guide
   asks for it:

   ```bash
   npx -y chrome-devtools-axi eval "(() => { const r = document.querySelector('<selector>'); const b = r.getBoundingClientRect(); const s = getComputedStyle(r); return { w: b.width, h: b.height, pad: s.padding, gap: s.gap, radius: s.borderRadius, size: s.fontSize, lh: s.lineHeight, weight: s.fontWeight }; })()"
   ```

3. **Measure motion** by reading `transitionDuration`, `transitionTimingFunction` and
   `animationDuration` of the element, then trigger it (`hover @<uid>`, `click @<uid>`) and read it
   again. Record duration in ms and the easing as a cubic-bezier. For a layout that changes
   with width, record the breakpoint where it changes: resize in steps and note the widths.
4. **Convert to our scale** and write the table: each measured value, the nearest token (`spacing`,
   `sizing`, `radius`, `type style`, `duration`), and the delta. A value that fits no token is
   noted as a gap for the guide, not hardcoded.
5. **Done** when every measure in your table has a unit, a viewport and a token mapping, and the
   spec or ticket links the table. Close the browser with `stop`.

## What the table holds

| Surface | Viewport | Property | Measured | Our token |
|---|---|---|---|---|
| video card title | 1440 | font-size / line-height | 14 px / 20 px | `title-sm` |

## Keep out of the repo

- Screenshots, SVGs, fonts, icons, logos, copy and image files of the outside product. A screenshot
  stays in the scratchpad for your own reading and is never committed.
- Class names, DOM structure and CSS source of the outside product.
- Their brand colours as our values: a colour is read for its role and contrast, then mapped to a
  role in our theme.
