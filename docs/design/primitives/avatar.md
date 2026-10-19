# Avatar

A person or channel as a picture, falling back to a monogram, in a fixed set of sizes.

## Anatomy

```
     .--------.
    /  (1)     \     (2) live ring, a `bg` gap and a `live` ring, each `border.focus` wide
   |   image    |
    \  or  T   /     (3) monogram fallback
     '--------'
```

| # | Part | Notes |
|---|---|---|
| 1 | Image | `object-fit: cover`, `alt` is the name. Radix `Avatar.Image`. |
| 2 | Live ring | Optional; `bg` gap then `live`, both `border.focus` wide. Means the channel is live now, nothing else. |
| 3 | Fallback | First letter of the name, passed as the child on `tint-strong`, `fg`; shows while loading and on error. |

## API

```ts
// types.ts
import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type AvatarSize = SizeOption;
export type AvatarShape = 'circle' | 'square';
export type AvatarTone = Extract<ToneOption, 'neutral' | 'live'>;
```

```ts
interface AvatarRootProps extends ComponentPropsWithRef<typeof Avatar.Root> {   // Radix Avatar
  size?: AvatarSize;    // sizing.avatar; default 'md'
  shape?: AvatarShape;  // default 'circle'
  tone?: AvatarTone;    // 'live' draws the live ring
}
// Parts: Avatar.Root (the options above), Avatar.Image (native img props, alt required), Avatar.Fallback (children: the monogram)
```

`size`, `shape` and `tone` live on the root and reach the parts through context. `AvatarShape` stays component-local: no shared union names a circle or square box. Today's `Avatar` takes `name` and `src` and derives both; the target moves that derivation to a small helper in the caller or pattern, since the primitive holds no copy. Sizes are the `sizing.avatar` keys, so the pixel values follow the viewer's sizing set.

```tsx
<Avatar.Root size="lg" tone="live">
  <Avatar.Image src={channel.avatarUrl} alt={channel.name} />
  <Avatar.Fallback>M</Avatar.Fallback>
</Avatar.Root>
```

## Variants and sizes

| Size | Box | Monogram | Where |
|---|---|---|---|
| `xs` | `sizing.avatar.xs` | hidden | Card byline dot |
| `sm` | `sizing.avatar.sm` | `overline` | Comment reply, chips |
| `md` | `sizing.avatar.md` | `label` | Comment, header account |
| `lg` | `sizing.avatar.lg` | `title` | Channel row, queue |
| `xl` | `sizing.avatar.xl` | `headline` | Channel header |

| Shape | Roles | When |
|---|---|---|
| `circle` | `tint-strong` ground | People and channels. |
| `square` | radius `sm` | Playlists and brand-owned entities in Studio. |

## States

| State | What changes |
|---|---|
| Rest | Image, or monogram on `tint-strong`. |
| Loading | Fallback shown until the image loads (Radix `delayMs` 0). |
| Error | Fallback stays; no broken-image icon. |
| Live (`tone="live"`) | Two-step ring: `bg` gap then `live`. |
| Hover, focus, pressed | Only when wrapped by a link or button, which owns them. |

## Tokens

- Colour roles `tint-strong`, `fg`, `live`, `bg`.
- `sizing`: `avatar` xs to xl (the shared `SizeOption` keys).
- `border`: `focus` for the live ring widths. `radius`: `sm` for square; circle is `border-radius: 50%` geometry.
- Type `overline`, `label`, `title`, `headline` by size.
- `motion`: `fast` for the image fade-in; nothing else moves.

## Accessibility

- With an image, `alt={name}`. The fallback has `role="img"` and `aria-label={name}` once.
- When the name is already printed beside the avatar, use an empty `alt` on `Avatar.Image` and hide the fallback with `aria-hidden` so it is not read twice.
- The live ring is not the only signal: pair it with a [badge](badge.md) `live` where the state matters.

## Extension points

- `className` on every part, merged with `cn`; `asChild` on `Avatar.Image` and `Avatar.Fallback`.
- `useAvatar()` returns `{ size, shape, tone }`, so a part written in an app can read it.
- `avatarStyles`, the `tv()` definition, is exported: `tv({ extend: avatarStyles, variants: { ... } })` adds an app-local variant.

## Do and don't

- Do always give `Avatar.Image` an `alt`, and a fallback letter.
- Do use `xs` for the card byline dot, never a different size.
- Don't use `live` for "online" presence.
- Don't stretch a non-square image; the box crops.
- Don't colour the fallback per user; it stays neutral so thumbnails carry the colour.
- Don't put text inside a 16 px avatar.

## In the workbench

Stories: every size (5), both shapes, image loaded, image error, no `src`, live ring, long name, a non-Latin name (monogram from the first grapheme), grouped overlap row. Axes: themes by modes, RTL (overlap direction), more contrast.
