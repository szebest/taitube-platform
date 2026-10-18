# AspectRatio

A box that keeps a fixed width-to-height ratio for its child, so media reserves its space before it loads.

## Anatomy

```
   +------------------------------+
   |  (1) child fills the box     |   16:9
   +------------------------------+
```

| # | Part | Notes |
|---|---|---|
| 1 | Box | Takes the width of its parent; height follows the ratio. Child is `object-fit: cover`. |

## API

```ts
// types.ts
export type MediaShape = 'video' | 'poster' | 'square' | 'banner';
```

```ts
interface AspectRatioProps extends ComponentPropsWithRef<typeof AspectRatio.Root> { // Radix: ratio
  shape?: MediaShape;   // 16:9, 9:16, 1:1, 21:9; default 'video'
}
```

`MediaShape` stays component-local: it names the ratios the product uses, which no shared union does. A custom `ratio` number from Radix overrides it. The box has no colour of its own: pair it with a `Skeleton` or the `media` ground when the image is missing.

```tsx
<AspectRatio shape="poster"><img src={short.poster} alt="" /></AspectRatio>
```

## Variants and sizes

| Shape | Ratio | When to use |
|---|---|---|
| `video` | 16:9 | Video cards, the player stage, the now playing picture. |
| `poster` | 9:16 | Shorts. |
| `square` | 1:1 | Playlists, avatars at large size. |
| `banner` | 21:9 | The channel banner. |

Radius is set by the child or the wrapping component (`thumb` for video frames); the primitive does not round.

## States

| State | What changes |
|---|---|
| Rest | Reserves the ratio. |
| Loading | The box stays; a [skeleton](skeleton.md) fills it. |
| Error | The box stays; the component shows a `media` ground and an icon. |
| Hover, focus, pressed, disabled | Not applicable. |

## Tokens

- Colour roles: none (`media` on a missing image ground). `radius`: from the child, usually `thumb`.
- Type and motion: none. This is how the layout keeps CLS under 0.05.

## Accessibility

- A plain `div`; no role.
- The image inside carries `alt` (empty when decorative, as for a thumbnail under a titled link).
- A ratio box is never a focus target; the link or button around it is.
- Do not rely on it to crop meaningful content out of view.

## Do and don't

- Do wrap every thumbnail, poster and banner.
- Do use the named `shape`s instead of numbers.
- Do give the image `object-fit: cover`.
- Don't set a fixed height on the same box.
- Don't put text content that must not be cropped inside.
- Don't use it for layout columns.

## In the workbench

Stories: each shape, with an image, with a skeleton, with an error ground, in a grid of mixed shapes. Axes: themes by modes (the radius from the parent), RTL, 320 px and 2560 px widths.
