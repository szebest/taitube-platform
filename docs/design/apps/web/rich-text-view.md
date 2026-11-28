# RichTextView

Location: `apps/client/web/src/components/channel/rich-text-view/`, presentational.

The creator's rich text, drawn from the tree `@vp/validation` builds out of the Markdown the save already checked.

## Rules

- Elements, never HTML: paragraphs, `h2`, `h3`, `strong`, `em`, lists, line breaks, links and images. Markup in the text is text.
- Every link is `https`, opens in a new tab and carries `rel="nofollow noopener ugc"`.
- An image is drawn only for a `page-image` id that is in the `images` map the page response carries (the channel's own ready uploads); otherwise it is left out. Nothing loads from another origin.
- Alt text comes from the Markdown, and the save refuses an image without it.

## Props

```ts
interface RichTextViewProps {
  tree: readonly RichTextBlock[];
  images: Readonly<Record<string, { w640: string; w1280: string }>>;
}
```

## Accessibility

Headings keep the order the creator wrote; the section title above is the `h2`, so the creator's own `h2` and `h3` sit below it in the document outline of the tab. Links keep the accent ink and the focus ring.

## Used by

[121](../../../tickets/121-channel-page-builder.md) `rich_text` sections.
