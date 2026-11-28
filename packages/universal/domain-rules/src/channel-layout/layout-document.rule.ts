import { type Result, andThen, err, isErr, ok } from '@kit/result';
import { type ChannelLayout, LAYOUT_LIMITS, tabSections } from '@vp/domain';
import { type InvalidLayoutMarkdown, validateRichText } from '@vp/validation';
import type { LayoutLimitExceeded, LayoutSlugInvalid, LayoutStructureInvalid } from './failures';
import { decideLayoutCaps } from './layout-caps.rule';
import { decideLayoutSlugs } from './layout-slugs.rule';
import { decideLayoutStructure } from './layout-structure.rule';

export type LayoutDocumentFailure =
  | LayoutLimitExceeded
  | LayoutStructureInvalid
  | LayoutSlugInvalid
  | InvalidLayoutMarkdown;

function decideRichText(layout: ChannelLayout): Result<ChannelLayout, InvalidLayoutMarkdown> {
  for (const section of layout.tabs.flatMap(tabSections)) {
    if (section.kind !== 'rich_text') continue;
    const checked = validateRichText(section.body, {
      maxChars: LAYOUT_LIMITS.richTextChars,
      maxImages: LAYOUT_LIMITS.richTextImages,
    });
    if (isErr(checked)) return err(checked.error);
  }
  return ok(layout);
}

export function decideLayoutDocument(
  layout: ChannelLayout,
  published: ChannelLayout | null
): Result<ChannelLayout, LayoutDocumentFailure> {
  return andThen(decideLayoutCaps(layout), (capped) =>
    andThen(decideLayoutStructure(capped), (structured) =>
      andThen(decideLayoutSlugs(structured, published), decideRichText)
    )
  );
}
