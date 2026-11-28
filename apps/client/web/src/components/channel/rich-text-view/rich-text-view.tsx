import { assertNever } from '@kit/result';
import { cn } from '@kit/ui';
import type { RichTextBlock, RichTextInline } from '@vp/validation';
import { type ComponentPropsWithRef, Fragment } from 'react';

export interface RichTextViewProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  tree: readonly RichTextBlock[];
  /** The ready `page-image` variants of the channel by id; an image not in it is not drawn. */
  images: Readonly<Record<string, { readonly w640: string; readonly w1280: string }>>;
}

function Inlines({
  nodes,
  images,
}: {
  nodes: readonly RichTextInline[];
  images: RichTextViewProps['images'];
}) {
  return nodes.map((node) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={node.key}>{node.value}</Fragment>;
      case 'break':
        return <br key={node.key} />;
      case 'strong':
        return (
          <strong key={node.key}>
            <Inlines nodes={node.children} images={images} />
          </strong>
        );
      case 'emphasis':
        return (
          <em key={node.key}>
            <Inlines nodes={node.children} images={images} />
          </em>
        );
      case 'link':
        return (
          <a
            key={node.key}
            href={node.url}
            target="_blank"
            rel="nofollow noopener ugc"
            className="text-accent-ink underline focus-ring"
          >
            <Inlines nodes={node.children} images={images} />
          </a>
        );
      case 'image': {
        const image = images[node.imageId];
        return image ? (
          <img
            key={node.key}
            src={image.w1280}
            srcSet={`${image.w640} 640w, ${image.w1280} 1280w`}
            sizes="(min-width: 48rem) 40rem, 100vw"
            alt={node.alt}
            loading="lazy"
            decoding="async"
            className="my-stack h-auto max-w-full rounded-card"
          />
        ) : null;
      }
      default:
        return assertNever(node, 'RichTextInline');
    }
  });
}

function Blocks({
  blocks,
  images,
}: {
  blocks: readonly RichTextBlock[];
  images: RichTextViewProps['images'];
}) {
  return blocks.map((block) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <p key={block.key} className="m-0">
            <Inlines nodes={block.children} images={images} />
          </p>
        );
      case 'heading': {
        const Heading = block.depth === 2 ? 'h2' : 'h3';
        return (
          <Heading
            key={block.key}
            className={cn('m-0 text-balance', block.depth === 2 ? 'text-title-lg' : 'text-title')}
          >
            <Inlines nodes={block.children} images={images} />
          </Heading>
        );
      }
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List
            key={block.key}
            className={cn('m-0 ps-inset-card', block.ordered ? 'list-decimal' : 'list-disc')}
          >
            {block.items.map((item) => (
              <li key={item.key}>
                <Blocks blocks={item.blocks} images={images} />
              </li>
            ))}
          </List>
        );
      }
      default:
        return assertNever(block, 'RichTextBlock');
    }
  });
}

/** The creator's whitelisted rich text, drawn as elements: never as HTML, links always `nofollow noopener ugc`, images only from the creator's own uploads. */
export function RichTextView({ tree, images, className, ...props }: RichTextViewProps) {
  return (
    <div
      data-slot="rich-text-view"
      className={cn('flex min-w-0 flex-col gap-stack text-body text-fg', className)}
      {...props}
    >
      <Blocks blocks={tree} images={images} />
    </div>
  );
}
