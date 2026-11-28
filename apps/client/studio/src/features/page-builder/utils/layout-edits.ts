import { assertNever } from '@kit/result';
import {
  type ChannelLayout,
  contentSection,
  type CustomTab,
  EVERYONE_VISIBILITY,
  LAYOUT_LIMITS,
  type LayoutSection,
  type LayoutTab,
  PINNED_TAB_KINDS,
  tabSections,
} from '@vp/domain';

export const SECTION_BLOCKS = [
  'videos',
  'shorts',
  'posts',
  'live',
  'playlists',
  'start_here',
  'rich_text',
  'links',
  'featured_channels',
] as const;
export type SectionBlock = (typeof SECTION_BLOCKS)[number];

const HIDDEN_UNTIL = '1970-01-01T00:00:00.000Z';
const SLUG_MAX = 30;

export const isPinnedTab = ({ kind }: LayoutTab): boolean =>
  PINNED_TAB_KINDS.some((pinned) => pinned === kind);

export const isSectionHidden = ({ visibility }: LayoutSection): boolean =>
  visibility.to === HIDDEN_UNTIL;

export function sectionsOf(layout: ChannelLayout): LayoutSection[] {
  return layout.tabs.flatMap(tabSections);
}

export function findSectionTab(layout: ChannelLayout, sectionId: string): LayoutTab | undefined {
  return layout.tabs.find((tab) => tabSections(tab).some(({ id }) => id === sectionId));
}

function customTabsOf(layout: ChannelLayout): CustomTab[] {
  return layout.tabs.filter((tab): tab is CustomTab => tab.kind === 'custom');
}

export function canAddTab(layout: ChannelLayout): boolean {
  return (
    layout.tabs.length < LAYOUT_LIMITS.tabs &&
    customTabsOf(layout).length < LAYOUT_LIMITS.customTabs
  );
}

export function canAddSection(layout: ChannelLayout, tabId: string): boolean {
  const tab = layout.tabs.find(({ id }) => id === tabId);
  return (
    tab !== undefined &&
    tabSections(tab).length < LAYOUT_LIMITS.sectionsPerTab &&
    sectionsOf(layout).length < LAYOUT_LIMITS.sections
  );
}

function takenIds(layout: ChannelLayout): Set<string> {
  return new Set([...layout.tabs.map(({ id }) => id), ...sectionsOf(layout).map(({ id }) => id)]);
}

function freshValue(prefix: string, taken: ReadonlySet<string>, max = 40): string {
  for (let count = 1; ; count += 1) {
    const suffix = `-${count}`;
    const candidate = `${prefix.slice(0, max - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

function mapTabs(layout: ChannelLayout, change: (tab: LayoutTab) => LayoutTab): ChannelLayout {
  return { ...layout, tabs: layout.tabs.map(change) };
}

function mapSections(
  layout: ChannelLayout,
  tabId: string,
  change: (sections: LayoutSection[]) => LayoutSection[]
): ChannelLayout {
  return mapTabs(layout, (tab) =>
    tab.id === tabId && (tab.kind === 'home' || tab.kind === 'custom')
      ? { ...tab, sections: change(tab.sections) }
      : tab
  );
}

function orderedBy<T extends { id: string }>(items: readonly T[], order: readonly string[]): T[] {
  return order.flatMap((id) => items.filter((item) => item.id === id));
}

export function reorderTabs(layout: ChannelLayout, order: readonly string[]): ChannelLayout {
  return { ...layout, tabs: orderedBy(layout.tabs, order) };
}

export function renameTab(layout: ChannelLayout, tabId: string, title: string): ChannelLayout {
  return mapTabs(layout, (tab) => (tab.id === tabId ? { ...tab, title } : tab));
}

export function setTabHidden(layout: ChannelLayout, tabId: string, hidden: boolean): ChannelLayout {
  return mapTabs(layout, (tab) =>
    tab.id === tabId && !isPinnedTab(tab) ? { ...tab, hidden } : tab
  );
}

export function setLanding(
  layout: ChannelLayout,
  audience: keyof ChannelLayout['landing'],
  tabId: string
): ChannelLayout {
  return { ...layout, landing: { ...layout.landing, [audience]: tabId } };
}

export function addCustomTab(layout: ChannelLayout, title: string): ChannelLayout {
  if (!canAddTab(layout)) {
    return layout;
  }
  const slugs = new Set(customTabsOf(layout).map(({ slug }) => slug));
  const tab: CustomTab = {
    kind: 'custom',
    id: freshValue('tab', takenIds(layout)),
    title: title.slice(0, LAYOUT_LIMITS.tabTitle),
    hidden: false,
    visibility: EVERYONE_VISIBILITY,
    slug: freshValue('page', slugs, SLUG_MAX),
    icon: null,
    description: null,
    header: null,
    sections: [],
  };
  return { ...layout, tabs: [...layout.tabs, tab] };
}

export type CustomTabChanges = Partial<
  Pick<CustomTab, 'title' | 'slug' | 'icon' | 'description' | 'header'>
>;

export function updateCustomTab(
  layout: ChannelLayout,
  tabId: string,
  changes: CustomTabChanges
): ChannelLayout {
  return mapTabs(layout, (tab) =>
    tab.id === tabId && tab.kind === 'custom' ? { ...tab, ...changes } : tab
  );
}

function copyOf(layout: ChannelLayout, sections: LayoutSection[]): LayoutSection[] {
  const taken = takenIds(layout);
  return sections.map((section) => {
    const id = freshValue(section.id, taken);
    taken.add(id);
    return { ...section, id };
  });
}

export function duplicateTab(layout: ChannelLayout, tabId: string): ChannelLayout {
  const index = layout.tabs.findIndex(({ id }) => id === tabId);
  const source = layout.tabs[index];
  if (source?.kind !== 'custom' || !canAddTab(layout)) {
    return layout;
  }
  const slugs = new Set(customTabsOf(layout).map(({ slug }) => slug));
  const tab: CustomTab = {
    ...source,
    id: freshValue(source.id, takenIds(layout)),
    title: source.title.slice(0, LAYOUT_LIMITS.tabTitle),
    slug: freshValue(source.slug, slugs, SLUG_MAX),
    sections: copyOf(layout, source.sections),
  };
  return { ...layout, tabs: layout.tabs.toSpliced(index + 1, 0, tab) };
}

export function removeTab(layout: ChannelLayout, tabId: string): ChannelLayout {
  const tab = layout.tabs.find(({ id }) => id === tabId);
  if (tab?.kind !== 'custom') {
    return layout;
  }
  const fallback = (landing: string) => (landing === tabId ? 'home' : landing);
  const without = mapTabs(
    { ...layout, tabs: layout.tabs.filter(({ id }) => id !== tabId) },
    (other) =>
      other.kind === 'home' || other.kind === 'custom'
        ? {
            ...other,
            sections: other.sections.map((section) =>
              section.kind === 'content' && section.seeAll === tabId
                ? { ...section, seeAll: null }
                : section
            ),
          }
        : other
  );
  return {
    ...without,
    landing: {
      visitor: fallback(layout.landing.visitor),
      subscriber: fallback(layout.landing.subscriber),
    },
  };
}

export function reorderSections(
  layout: ChannelLayout,
  tabId: string,
  order: readonly string[]
): ChannelLayout {
  return mapSections(layout, tabId, (sections) => orderedBy(sections, order));
}

export function newSection(block: SectionBlock, id: string, title: string): LayoutSection {
  switch (block) {
    case 'videos':
      return contentSection(id, { type: 'videos' }, title);
    case 'shorts':
      return contentSection(id, { type: 'shorts' }, title);
    case 'posts':
      return contentSection(id, { type: 'posts' }, title);
    case 'live':
      return contentSection(id, { type: 'live' }, title);
    case 'playlists':
      return contentSection(id, { type: 'playlists' }, title);
    case 'start_here':
      return contentSection(id, { type: 'start_here' }, title);
    default:
      return otherSection(block, id, title);
  }
}

function otherSection(
  block: 'rich_text' | 'links' | 'featured_channels',
  id: string,
  title: string
): LayoutSection {
  const base = contentSection(id, { type: 'videos' }, title);
  const { presentation, visibility } = base;
  switch (block) {
    case 'rich_text':
      return { kind: 'rich_text', id, body: '', presentation, visibility };
    case 'links':
      return { kind: 'links', id, links: [], presentation, visibility };
    case 'featured_channels':
      return { kind: 'featured_channels', id, channelIds: [], presentation, visibility };
    default:
      return assertNever(block, 'SectionBlock');
  }
}

export function addSection(
  layout: ChannelLayout,
  tabId: string,
  block: SectionBlock,
  title: string
): ChannelLayout {
  if (!canAddSection(layout, tabId)) {
    return layout;
  }
  const section = newSection(block, freshValue('section', takenIds(layout)), title);
  return mapSections(layout, tabId, (sections) => [...sections, section]);
}

export function replaceSection(layout: ChannelLayout, section: LayoutSection): ChannelLayout {
  return mapTabs(layout, (tab) =>
    tab.kind === 'home' || tab.kind === 'custom'
      ? { ...tab, sections: tab.sections.map((held) => (held.id === section.id ? section : held)) }
      : tab
  );
}

export function duplicateSection(layout: ChannelLayout, sectionId: string): ChannelLayout {
  const tab = findSectionTab(layout, sectionId);
  if (tab === undefined || !canAddSection(layout, tab.id)) {
    return layout;
  }
  return mapSections(layout, tab.id, (sections) => {
    const index = sections.findIndex(({ id }) => id === sectionId);
    const [copy] = copyOf(layout, sections.slice(index, index + 1));
    return copy === undefined ? sections : sections.toSpliced(index + 1, 0, copy);
  });
}

export function removeSection(layout: ChannelLayout, sectionId: string): ChannelLayout {
  const tab = findSectionTab(layout, sectionId);
  return tab === undefined
    ? layout
    : mapSections(layout, tab.id, (sections) => sections.filter(({ id }) => id !== sectionId));
}

export function setSectionHidden(
  layout: ChannelLayout,
  sectionId: string,
  hidden: boolean
): ChannelLayout {
  const section = sectionsOf(layout).find(({ id }) => id === sectionId);
  return section === undefined
    ? layout
    : replaceSection(layout, {
        ...section,
        visibility: { ...section.visibility, from: null, to: hidden ? HIDDEN_UNTIL : null },
      });
}
