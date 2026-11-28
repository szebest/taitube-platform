import type { Failure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';

export type MarkdownRefusal =
  | 'too_long'
  | 'too_many_images'
  | 'html'
  | 'node'
  | 'heading'
  | 'link_scheme'
  | 'image_reference'
  | 'image_alt';

export type InvalidLayoutMarkdown = Failure<
  typeof ErrorCodes.LAYOUT_MARKDOWN_INVALID,
  { reason: MarkdownRefusal }
>;

export function invalidLayoutMarkdown(reason: MarkdownRefusal): InvalidLayoutMarkdown {
  return {
    code: ErrorCodes.LAYOUT_MARKDOWN_INVALID,
    message: `Rich text refused: ${reason}`,
    reason,
  };
}
