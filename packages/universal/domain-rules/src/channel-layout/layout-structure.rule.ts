import { type Result, err, isErr, ok } from '@kit/result';
import { BUILT_IN_TAB_KINDS, type ChannelLayout, PINNED_TAB_KINDS, tabSections } from '@vp/domain';
import { validateChannelLinks } from '@vp/validation';
import { type LayoutStructureInvalid, layoutStructureInvalid } from './failures';

function firstRepeat(ids: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}

const isPinned = (kind: string): boolean => PINNED_TAB_KINDS.some((pinned) => pinned === kind);

/** The tabs and sections hold together: unique ids, each built-in once, Home and About shown, every link inside the layout. */
export function decideLayoutStructure(
  layout: ChannelLayout
): Result<ChannelLayout, LayoutStructureInvalid> {
  const tabIds = layout.tabs.map(({ id }) => id);
  const repeatedTab = firstRepeat(tabIds);
  if (repeatedTab) return err(layoutStructureInvalid('duplicate_tab', repeatedTab));

  const sections = layout.tabs.flatMap(tabSections);
  const repeatedSection = firstRepeat(sections.map(({ id }) => id));
  if (repeatedSection) return err(layoutStructureInvalid('duplicate_section', repeatedSection));

  for (const kind of BUILT_IN_TAB_KINDS) {
    const held = layout.tabs.filter((tab) => tab.kind === kind);
    if (held.length === 0) return err(layoutStructureInvalid('built_in_missing', kind));
    if (held.length > 1) return err(layoutStructureInvalid('built_in_repeated', kind));
  }
  const hiddenPinned = layout.tabs.find((tab) => tab.hidden && isPinned(tab.kind));
  if (hiddenPinned) return err(layoutStructureInvalid('pinned_tab_hidden', hiddenPinned.id));

  for (const landing of Object.values(layout.landing)) {
    if (!tabIds.includes(landing)) return err(layoutStructureInvalid('landing_unknown', landing));
  }
  for (const section of sections) {
    if (section.kind === 'content' && section.seeAll && !tabIds.includes(section.seeAll)) {
      return err(layoutStructureInvalid('see_all_unknown', section.seeAll));
    }
    if (section.kind === 'links' && isErr(validateChannelLinks(section.links))) {
      return err(layoutStructureInvalid('links_invalid', section.id));
    }
  }
  return ok(layout);
}
