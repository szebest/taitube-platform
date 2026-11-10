# PlatformIcon

The mark of a platform a channel links to (GitHub, X, Instagram and the rest), drawn from a path vendored in the repo, in one ink.

## Anatomy

```
   +----+
   | (1)|   a 24 x 24 brand mark, `currentColor`
   +----+
```

| # | Part | Notes |
|---|---|---|
| 1 | Mark | One filled path per platform. `website`, the fallback for a host the table does not know, is the `globe` glyph of [Icon](icon.md). |

## API

```ts
interface PlatformIconProps extends Omit<ComponentPropsWithRef<'svg'>, 'name'> {
  platform: LinkPlatform;  // the value `Channel.links[].platform` carries: website, github, x, instagram, tiktok, twitch, discord, mastodon, bluesky, linkedin, reddit, facebook
  size?: IconSize;         // sizing.icon; default 'md'
}
```

`LinkPlatform` and the host table that derives it from a URL are `@vp/domain`'s (`LINK_PLATFORMS`, `platformOfUrl`), so the studio can show the platform as a creator types and web can show it on About from the same rule. The component knows no URL.

```tsx
<PlatformIcon platform="github" size="sm" />
```

## Variants and sizes

One axis, `size`, the sizes of [Icon](icon.md): `sm`, `md` (default) and `lg`. There is no tone and no filled or outline pair: a brand mark keeps its own shape and takes the ink of its parent.

## States

Rest only. It takes no interaction; a link or button around it carries hover, focus and pressed.

## Tokens

`sizing.icon`. Ink is `currentColor`, so the parent's role applies. Radius, motion and type: none.

## Accessibility

- Decorative unless it has an `aria-label`, which makes it an image with that name; the link it sits in already names the platform, so it is almost always decorative.
- Contrast: it follows its parent's ink, which already meets 3:1 for graphics.

## Where the paths come from

The paths are generated once into `src/icons/platform-icon-paths.generated.json` by `pnpm gen:platform-icons` from the `simple-icons` devDependency (LinkedIn from `simple-icons-linkedin`, an alias of the last release that carried it, since later releases dropped the mark). Nothing is fetched at runtime and no package is imported by the browser bundle. `pnpm gen:platform-icons --check` fails on drift.

## Do and don't

- Do use it beside the link's label, never alone as the only name of an unfamiliar link.
- Do keep the platform's own shape: no recolouring to a brand colour, no box around it.
- Don't import a brand icon from any package in a component; add the platform to `LINK_PLATFORMS` and regenerate.

## In the workbench

Stories: every platform at each size, on `bg` and on `surface`. Axes: themes by modes, more contrast.
