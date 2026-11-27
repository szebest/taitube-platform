import {
  type ChannelLayout,
  type ContentSection,
  type LayoutSection,
  type LayoutVisibility,
  defaultChannelLayout,
} from '@vp/domain';

export const EVERYONE: LayoutVisibility = {
  audience: 'everyone',
  from: null,
  to: null,
  locales: [],
};

export function section(id: string, overrides: Partial<ContentSection> = {}): ContentSection {
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

export function homeWith(...sections: LayoutSection[]): ChannelLayout {
  const base = defaultChannelLayout();
  return {
    ...base,
    tabs: base.tabs.map((tab) => (tab.kind === 'home' ? { ...tab, sections } : tab)),
  };
}
