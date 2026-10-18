# State illustrations

Small spot illustrations for the empty, error and offline states ([README section 8, States](../../README.md#states)).
They are built from the mark's language, so a state reads as Taitube without a mascot.

## Style rules

- **Canvas**: `viewBox="0 0 240 160"`, drawn at 180 px wide by `.tt-state img`.
- **Vocabulary**: the mark's parts only. Rounded 16:9-ish frames (`rx` 14, the Sand `thumb` radius), half
  discs rising from a line, and a horizon line along the bottom (`y` 136) that grounds every drawing.
- **Two inks**: `currentColor` for the subject, `currentColor` at 30% opacity for the setting (ground, back
  frames, text lines). No third tone, no gradient, no fill tint.
- **Strokes**: 3 units, round caps and joins, matching the mark's frame stroke.
- **Colour**: the root carries `color="#C9A66B"` (Sand dark `accent`) so an `<img>` renders tinted. An
  `<img>` cannot inherit CSS `color`, so it stays ochre in every theme and mode; inlined (an SVGR component in
  `@vp/components`), any CSS `color` overrides the attribute and the drawing takes `accent` per theme.
- **Decorative**: `aria-hidden="true"`; the state's heading and line carry the meaning, so an `<img>` gets
  `alt=""`.
- **No text** inside a drawing, so nothing needs translating or mirroring under RTL.

## Which state uses which

| File | Drawing | Used by |
|---|---|---|
| [`empty-library.svg`](empty-library.svg) | stacked empty frames, a sun not yet risen, a plus | empty studio library, no videos on a channel, empty Watch later |
| [`no-results.svg`](no-results.svg) | a frame with a lens over it | no search results, a filter that matches nothing |
| [`offline.svg`](offline.svg) | a frame with a sun set below its horizon, signal arcs, a slash | offline |
| [`error.svg`](error.svg) | a tilted frame with a broken horizon, the sun fallen out | 500 page, a failed section's larger variant, 403 page |
| [`not-found.svg`](not-found.svg) | a dashed, missing frame with the sun rolled away | 404 page |
| [`no-notifications.svg`](no-notifications.svg) | a bell whose dome is the rising sun, resting | no notifications |
| [`no-comments.svg`](no-comments.svg) | two speech frames | no comments yet |
| [`signed-out.svg`](signed-out.svg) | the frame with a figure rising in it, a key | signed out, a page that needs an account |
