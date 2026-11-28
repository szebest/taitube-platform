import { assertNever, isOk } from '@kit/result';
import { type ChannelLayout, LAYOUT_LIMITS, tabSections } from '@vp/domain';
import { decideLayoutDocument } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { validateRichText } from '@vp/validation';
import { findSectionTab } from './layout-edits';

export interface LayoutProblemTarget {
  tabId: string;
  sectionId: string | null;
}

export interface LayoutProblem {
  code:
    | typeof ErrorCodes.LAYOUT_LIMIT_EXCEEDED
    | typeof ErrorCodes.LAYOUT_STRUCTURE_INVALID
    | typeof ErrorCodes.LAYOUT_SLUG_INVALID
    | typeof ErrorCodes.LAYOUT_MARKDOWN_INVALID;
  target: LayoutProblemTarget | null;
}

function sectionTarget(layout: ChannelLayout, sectionId: string): LayoutProblemTarget | null {
  const tab = findSectionTab(layout, sectionId);
  return tab === undefined ? null : { tabId: tab.id, sectionId };
}

function structureTarget(layout: ChannelLayout, id: string): LayoutProblemTarget | null {
  const asSection = sectionTarget(layout, id);
  if (asSection !== null) {
    return asSection;
  }
  return layout.tabs.some((tab) => tab.id === id) ? { tabId: id, sectionId: null } : null;
}

function markdownTarget(layout: ChannelLayout): LayoutProblemTarget | null {
  for (const tab of layout.tabs) {
    for (const section of tabSections(tab)) {
      const checked =
        section.kind === 'rich_text' &&
        validateRichText(section.body, {
          maxChars: LAYOUT_LIMITS.richTextChars,
          maxImages: LAYOUT_LIMITS.richTextImages,
        });
      if (checked && !isOk(checked)) {
        return { tabId: tab.id, sectionId: section.id };
      }
    }
  }
  return null;
}

/** What the document rules refuse in `layout` and the tab or section to open for it; null when it is sound. */
export function layoutProblem(layout: ChannelLayout): LayoutProblem | null {
  const decided = decideLayoutDocument(layout, null);
  if (isOk(decided)) {
    return null;
  }
  const failure = decided.error;
  switch (failure.code) {
    case ErrorCodes.LAYOUT_LIMIT_EXCEEDED:
      return { code: failure.code, target: null };
    case ErrorCodes.LAYOUT_STRUCTURE_INVALID:
      return { code: failure.code, target: structureTarget(layout, failure.id) };
    case ErrorCodes.LAYOUT_SLUG_INVALID: {
      const tab = layout.tabs.find((held) => held.kind === 'custom' && held.slug === failure.slug);
      return { code: failure.code, target: tab ? { tabId: tab.id, sectionId: null } : null };
    }
    case ErrorCodes.LAYOUT_MARKDOWN_INVALID:
      return { code: failure.code, target: markdownTarget(layout) };
    default:
      return assertNever(failure, 'LayoutDocumentFailure');
  }
}
