import { assertNever } from '@kit/result';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { PAGE_IMAGE_REFERENCE } from './rich-text';

type MarkdownNode = ReturnType<typeof fromMarkdown>['children'][number];

interface Keyed {
  /** Where the node sits in the tree: the same body always gives the same keys. */
  readonly key: string;
}

export type RichTextInline = Keyed &
  (
    | { readonly type: 'text'; readonly value: string }
    | { readonly type: 'break' }
    | { readonly type: 'strong'; readonly children: readonly RichTextInline[] }
    | { readonly type: 'emphasis'; readonly children: readonly RichTextInline[] }
    | { readonly type: 'link'; readonly url: string; readonly children: readonly RichTextInline[] }
    | { readonly type: 'image'; readonly imageId: string; readonly alt: string }
  );

export interface RichTextListItem extends Keyed {
  readonly blocks: readonly RichTextBlock[];
}

export type RichTextBlock = Keyed &
  (
    | { readonly type: 'paragraph'; readonly children: readonly RichTextInline[] }
    | {
        readonly type: 'heading';
        readonly depth: 2 | 3;
        readonly children: readonly RichTextInline[];
      }
    | {
        readonly type: 'list';
        readonly ordered: boolean;
        readonly items: readonly RichTextListItem[];
      }
  );

function inlinesOf(nodes: readonly MarkdownNode[], path: string): RichTextInline[] {
  return nodes.flatMap((node, position): RichTextInline[] => {
    const key = `${path}.${position}`;
    switch (node.type) {
      case 'text':
        return [{ key, type: 'text', value: node.value }];
      case 'break':
        return [{ key, type: 'break' }];
      case 'strong':
      case 'emphasis':
        return [{ key, type: node.type, children: inlinesOf(node.children, key) }];
      case 'link':
        return [{ key, type: 'link', url: node.url, children: inlinesOf(node.children, key) }];
      case 'image': {
        const imageId = PAGE_IMAGE_REFERENCE.exec(node.url)?.[1];
        return imageId === undefined
          ? []
          : [{ key, type: 'image', imageId: imageId.toLowerCase(), alt: node.alt ?? '' }];
      }
      default:
        return [];
    }
  });
}

function blocksOf(nodes: readonly MarkdownNode[], path: string): RichTextBlock[] {
  return nodes.flatMap((node, position): RichTextBlock[] => {
    const key = `${path}.${position}`;
    switch (node.type) {
      case 'paragraph':
        return [{ key, type: 'paragraph', children: inlinesOf(node.children, key) }];
      case 'heading':
        return node.depth === 2 || node.depth === 3
          ? [{ key, type: 'heading', depth: node.depth, children: inlinesOf(node.children, key) }]
          : [];
      case 'list':
        return [
          {
            key,
            type: 'list',
            ordered: node.ordered === true,
            items: node.children.map((item, itemPosition) => ({
              key: `${key}.${itemPosition}`,
              blocks: blocksOf(item.children, `${key}.${itemPosition}`),
            })),
          },
        ];
      default:
        return [];
    }
  });
}

/** The tree of a body the save already checked against the whitelist: anything outside it is left out, never rendered. */
export function richTextTree(body: string): RichTextBlock[] {
  return blocksOf(fromMarkdown(body).children, 'r');
}

function imageIdsOfInlines(nodes: readonly RichTextInline[]): string[] {
  return nodes.flatMap((node) => {
    switch (node.type) {
      case 'image':
        return [node.imageId];
      case 'strong':
      case 'emphasis':
      case 'link':
        return imageIdsOfInlines(node.children);
      case 'text':
      case 'break':
        return [];
      default:
        return assertNever(node, 'RichTextInline');
    }
  });
}

export function richTextImageIds(blocks: readonly RichTextBlock[]): string[] {
  return blocks.flatMap((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return imageIdsOfInlines(block.children);
      case 'list':
        return block.items.flatMap((item) => richTextImageIds(item.blocks));
      default:
        return assertNever(block, 'RichTextBlock');
    }
  });
}
