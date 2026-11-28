import { type Result, err, ok } from '@kit/result';
import {
  type ChannelLayout,
  LAYOUT_LIMITS,
  tabSections,
  type LayoutLimit,
  type LayoutSection,
} from '@vp/domain';
import { type LayoutLimitExceeded, layoutLimitExceeded } from './failures';

const ENCODER = new TextEncoder();

function pickedItems(section: LayoutSection): number {
  return section.kind === 'content' && section.source.type === 'picked'
    ? section.source.items.length
    : 0;
}

export function decideLayoutCaps(
  layout: ChannelLayout
): Result<ChannelLayout, LayoutLimitExceeded> {
  const sections = layout.tabs.map(tabSections);
  const measures: { limit: LayoutLimit; max: number; actual: number }[] = [
    {
      limit: 'document_bytes',
      max: LAYOUT_LIMITS.documentBytes,
      actual: ENCODER.encode(JSON.stringify(layout)).length,
    },
    { limit: 'tabs', max: LAYOUT_LIMITS.tabs, actual: layout.tabs.length },
    {
      limit: 'custom_tabs',
      max: LAYOUT_LIMITS.customTabs,
      actual: layout.tabs.filter(({ kind }) => kind === 'custom').length,
    },
    {
      limit: 'sections_per_tab',
      max: LAYOUT_LIMITS.sectionsPerTab,
      actual: Math.max(0, ...sections.map((list) => list.length)),
    },
    {
      limit: 'sections',
      max: LAYOUT_LIMITS.sections,
      actual: sections.reduce((total, list) => total + list.length, 0),
    },
    {
      limit: 'picked_items',
      max: LAYOUT_LIMITS.pickedItems,
      actual: Math.max(0, ...sections.flat().map(pickedItems)),
    },
  ];
  const broken = measures.find(({ max, actual }) => actual > max);
  return broken ? err(layoutLimitExceeded(broken.limit, broken.max, broken.actual)) : ok(layout);
}
