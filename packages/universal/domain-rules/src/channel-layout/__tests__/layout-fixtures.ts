import {
  type ChannelLayout,
  type ContentSection,
  type CustomTab,
  type LayoutSection,
  type LayoutVisibility,
  standardChannelLayout,
} from '@vp/domain';

const EVERYONE: LayoutVisibility = {
  audience: 'everyone',
  from: null,
  to: null,
  locales: [],
};

export function contentSection(
  id: string,
  overrides: Partial<ContentSection> = {}
): ContentSection {
  return {
    kind: 'content',
    id,
    source: { type: 'videos' },
    filters: { tags: [], dateRange: null, duration: null, hideWatched: false },
    sort: 'newest',
    layout: { type: 'shelf' },
    itemCount: 6,
    seeAll: null,
    presentation: {
      title: null,
      subtitle: null,
      background: null,
      accent: null,
      density: 'comfortable',
      show: { duration: true, views: true, date: true },
    },
    visibility: EVERYONE,
    hideWhenEmpty: true,
    ...overrides,
  };
}

export function customTab(id: string, slug: string, sections: LayoutSection[] = []): CustomTab {
  return {
    kind: 'custom',
    id,
    title: id,
    hidden: false,
    visibility: EVERYONE,
    slug,
    icon: null,
    description: null,
    header: null,
    sections,
  };
}

export function layoutWith(...extraTabs: CustomTab[]): ChannelLayout {
  const base = standardChannelLayout();
  return { ...base, tabs: [...base.tabs, ...extraTabs] };
}

export function layoutWithHomeSections(...sections: LayoutSection[]): ChannelLayout {
  const base = standardChannelLayout();
  return {
    ...base,
    tabs: base.tabs.map((tab) => (tab.kind === 'home' ? { ...tab, sections } : tab)),
  };
}
