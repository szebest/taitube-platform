# Skeleton

A placeholder block shaped like the content that is loading, with the loaded layout's exact dimensions.

## Anatomy

```
   +------------------------------+
   |  (1) block                   |  thumbnail
   +------------------------------+
   (o) (2) circle  [==== (3) line ====]
                   [=== (3) line ==]
```

| # | Part | Notes |
|---|---|---|
| 1 | Rect block | The thumbnail, a card body. |
| 2 | Circle | The avatar. |
| 3 | Text line | One line of text, height from the type style's line height. |

## API

```ts
// types.ts
import type { RadiusOption } from '@vp/design-tokens';

export type SkeletonShape = 'rect' | 'circle' | 'text';
export type SkeletonRadius = RadiusOption;
```

```ts
interface SkeletonProps extends ComponentPropsWithRef<'div'> {
  shape?: SkeletonShape;     // default 'rect'
  radius?: SkeletonRadius;   // for 'rect'; default 'thumb'
}
```

The size comes from `className` (or from the parent's layout), matching the loaded content exactly. `SkeletonShape` stays component-local: it names the geometry of a placeholder, which no shared union does. The radius role of a panel is passed with `radius`, not guessed. Today's `Skeleton` has no `shape` and a fixed `rounded-md`.

```tsx
<Skeleton shape="rect" radius="thumb" className="aspect-video w-full" />
```

## Variants and sizes

| Shape | Radius | When to use |
|---|---|---|
| `rect` | `radius`: `thumb` for video frames, `card` for panels | Thumbnails, panels. |
| `circle` | 50 percent geometry | Avatars. |
| `text` | `xs` | Lines of text, one block per line. |

Roles `tint` and `tint-strong`. No size axis: a skeleton is sized by what it replaces (an avatar skeleton uses `sizing.avatar`, a text line the type style's line height).

## States

| State | What changes |
|---|---|
| Rest | Gradient from `tint` through `tint-strong` to `tint`, shimmering across the block over 1.4 s. |
| Reduced motion | Static `tint`; no shimmer. |
| Replaced | The real content fades in over `motion.duration.base`; the layout does not move (CLS under 0.05). |

Hover, focus, pressed, disabled, invalid do not apply.

## Tokens

- Colour roles `tint`, `tint-strong`.
- `radius`: `thumb`, `card`, `xs` (any `RadiusOption`). `sizing`: `avatar` for circle placeholders.
- `motion`: `base` for the fade to content; the shimmer (1.4 s linear) is not a duration token. No type style; a text line uses the matching style's line height.

## Accessibility

- Purely visual: `aria-hidden="true"`.
- The loading region carries the state: `aria-busy="true"` on the container, and a [visually-hidden](visually-hidden.md) status text where the wait is long.
- No focusable skeletons; keyboard users should not tab into a placeholder.
- Contrast is not required for a decorative placeholder, but the block must remain visible on every ground (`tint` reads on all surfaces).

## Do and don't

- Do match the loaded layout's dimensions exactly.
- Do group skeletons into the same layout as the content.
- Do stop the shimmer under reduced motion.
- Don't show a skeleton for a wait under about 200 ms.
- Don't use a skeleton for an action in progress; use [spinner](spinner.md) or `loading` on a button.
- Don't invent a different layout from the loaded one.

## In the workbench

Stories: each shape; a video card skeleton; a comment skeleton; a row skeleton; a skeleton swapped for loaded content (no layout shift); long list. Axes: themes by modes, compact density, RTL, reduced motion (static), 320 px width.
