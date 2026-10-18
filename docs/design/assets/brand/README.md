# Brand assets

The mark is a 16:9 frame with a sun rising on its lower edge; the wordmark is `taitube`, lowercase, in the UI
face at weight 800 and `-0.045em` tracking ([README section 6](../../README.md#6-mark-and-icons)).

| File | What it is | Ink |
|---|---|---|
| [`mark.svg`](mark.svg) | the mark alone, 32 x 22 | `currentColor` |
| [`wordmark.svg`](wordmark.svg) | the wordmark as live text, a reference | `currentColor` |
| [`lockup-horizontal.svg`](lockup-horizontal.svg) | mark at 1.5x beside the wordmark, gap 12 | `currentColor` |
| [`favicon.svg`](favicon.svg) | the mark on a 32 x 32 square, legible at 16 px | ochre-700 on light, ochre-500 on dark, by `prefers-color-scheme` |
| [`app-icon.svg`](app-icon.svg) | 512 x 512 rounded square for install surfaces | Sand dark: `#14120F` ground, `#C9A66B` mark |
| [`app-icon-maskable.svg`](app-icon-maskable.svg) | full-bleed ground, the mark inside the 80% safe zone | Sand dark |
| [`og-template.svg`](og-template.svg) | the 1200 x 630 social card layout: glow, thumbnail box, channel, title, meta, lockup | Sand dark |

The wordmark files use `<text>` with `Figtree Variable` and a fallback stack, so they show the layout, not the
exact letterforms. The shipped wordmark is set in the bundled font (`@fontsource-variable/figtree`), never
loaded from another host.

## Clear space

Keep clear space on every side equal to **half the mark's height**: 11 units around the 22-unit mark, 16.5 px
around the lockup's 33 px mark. Nothing (text, an edge, another logo) enters it.

## Minimum sizes

| Asset | Smallest |
|---|---|
| Mark | 16 px wide (the favicon); below 24 px use `favicon.svg`, whose frame stroke is tuned for it |
| Lockup | 96 px wide, so the wordmark stays at 18 px or more |
| Wordmark alone | 14 px cap height; under that, use the mark |

## Colour per theme

The mark and wordmark take roles, never a fixed colour:

| Where | Mark | Wordmark |
|---|---|---|
| App header | `accent` | `fg` |
| Anywhere else in the UI | `fg` | `fg` |
| On video or a scrim | white | white |
| Install surfaces and favicons | the Sand values in the files above | |

`accent` resolves per theme and mode: ochre-500 in Sand dark and OLED, ochre-700 in Sand light, amber in
Nocturne. The single-ink files use `currentColor`, so CSS sets the role.

## Don't

- Never put a play triangle in a coloured box, and never turn the mark into one.
- Never recolour outside the roles above: no gradients, no brand colour of another product, no second ink.
- Never add effects: no shadow, glow, outline, bevel or animation on the mark or the wordmark.
- Never stretch, rotate, re-space or re-draw the parts; scale the file whole.
- Never set the wordmark in a face other than the theme's UI face, and never capitalise it.
