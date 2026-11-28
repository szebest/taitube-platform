# SectionBackdrop

Location: `apps/client/web/src/components/channel/section-backdrop/`, presentational.

The creator's picture behind one section, under a scrim so the text over it keeps its contrast. Decorative: the image has empty alt text.

## Props

```ts
interface SectionBackdropProps {
  image: { w640: string; w1280: string };
}
```

The variants are the channel's own `page-image` (`srcset` 640 and 1280 wide); nothing is drawn from another origin. Content sits above the scrim in `on-media` ink.

## States

| State | What changes |
|---|---|
| no ready image | the wrapper draws the section without a backdrop |
| reduced data | the image loads lazily and decodes asynchronously |

## Used by

[121](../../../tickets/121-channel-page-builder.md) a section with a `background`.
