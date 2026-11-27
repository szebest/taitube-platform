import { type Result, err, ok } from '@kit/result';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { isHttpsUrl } from '../channels/https-url';
import { type InvalidLayoutMarkdown, invalidLayoutMarkdown } from './failures';

export interface RichTextLimits {
  readonly maxChars: number;
  readonly maxImages: number;
}

type MarkdownNode = ReturnType<typeof fromMarkdown>['children'][number];

const PAGE_IMAGE_REFERENCE =
  /^page-image:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const ALLOWED_HEADING_DEPTHS: readonly number[] = [2, 3];

function refusalOf(node: MarkdownNode, imageIds: string[]): InvalidLayoutMarkdown | null {
  switch (node.type) {
    case 'text':
    case 'break':
      return null;
    case 'paragraph':
    case 'strong':
    case 'emphasis':
    case 'list':
    case 'listItem':
      return firstRefusal(node.children, imageIds);
    case 'heading':
      return ALLOWED_HEADING_DEPTHS.includes(node.depth)
        ? firstRefusal(node.children, imageIds)
        : invalidLayoutMarkdown('heading');
    case 'link':
      return isHttpsUrl(node.url)
        ? firstRefusal(node.children, imageIds)
        : invalidLayoutMarkdown('link_scheme');
    case 'image': {
      const id = PAGE_IMAGE_REFERENCE.exec(node.url)?.[1];
      if (id === undefined) return invalidLayoutMarkdown('image_reference');
      if (!node.alt?.trim()) return invalidLayoutMarkdown('image_alt');
      imageIds.push(id.toLowerCase());
      return null;
    }
    case 'html':
      return invalidLayoutMarkdown('html');
    default:
      return invalidLayoutMarkdown('node');
  }
}

function firstRefusal(
  nodes: readonly MarkdownNode[],
  imageIds: string[]
): InvalidLayoutMarkdown | null {
  for (const node of nodes) {
    const refusal = refusalOf(node, imageIds);
    if (refusal) return refusal;
  }
  return null;
}

/**
 * Parses the body with the parser the studio's description preview renders with and walks the
 * tree against a whitelist: paragraphs, h2 and h3, bold, italic, lists, line breaks, https links
 * and images that name a `page-image:<id>` with alt text. Answers the image ids the body uses.
 */
export function validateRichText(
  body: string,
  { maxChars, maxImages }: RichTextLimits
): Result<readonly string[], InvalidLayoutMarkdown> {
  if (body.length > maxChars) return err(invalidLayoutMarkdown('too_long'));
  const imageIds: string[] = [];
  const refusal = firstRefusal(fromMarkdown(body).children, imageIds);
  if (refusal) return err(refusal);
  return imageIds.length > maxImages ? err(invalidLayoutMarkdown('too_many_images')) : ok(imageIds);
}
