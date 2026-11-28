import {
  type ChannelLayout,
  contentSection,
  type ContentSection,
  type CustomTab,
  EVERYONE_VISIBILITY,
  type LayoutSection,
  type LayoutTab,
  standardChannelLayout,
} from './channel-layout';

export const CHANNEL_LAYOUT_TEMPLATES = ['creator_starter', 'series_focused', 'blank'] as const;
export type ChannelLayoutTemplate = (typeof CHANNEL_LAYOUT_TEMPLATES)[number];

function withHomeSections(sections: LayoutSection[], extraTabs: CustomTab[] = []): ChannelLayout {
  const standard = standardChannelLayout();
  const tabs = standard.tabs.flatMap((tab): LayoutTab[] =>
    tab.kind === 'home' ? [{ ...tab, sections }, ...extraTabs] : [tab]
  );
  return { ...standard, tabs };
}

function creatorStarter(): ChannelLayout {
  const popular: ContentSection = {
    ...contentSection('popular', { type: 'videos' }, 'Popular'),
    sort: 'popular',
    seeAll: 'videos',
  };
  const playlists: ContentSection = {
    ...contentSection('playlists', { type: 'playlists' }, 'Playlists'),
    seeAll: 'playlists',
  };
  const latest: ContentSection = {
    ...contentSection('latest', { type: 'videos' }, 'Latest uploads'),
    seeAll: 'videos',
  };
  return withHomeSections([
    contentSection('start-here', { type: 'start_here' }, 'Start here'),
    latest,
    popular,
    playlists,
    {
      kind: 'featured_channels',
      id: 'featured-channels',
      channelIds: [],
      presentation: {
        ...latest.presentation,
        title: { default: 'Channels I like' },
      },
      visibility: EVERYONE_VISIBILITY,
    },
  ]);
}

function seriesFocused(): ChannelLayout {
  const newest: ContentSection = {
    ...contentSection('newest-episode', { type: 'videos' }, 'The newest episode'),
    layout: { type: 'hero' },
    itemCount: 1,
    seeAll: 'episodes',
  };
  const series: ContentSection = {
    ...contentSection('series', { type: 'playlists' }, 'The series'),
    layout: { type: 'grid', columns: 3 },
    itemCount: 6,
    seeAll: 'playlists',
  };
  const episodes: CustomTab = {
    kind: 'custom',
    id: 'episodes',
    title: 'Episodes',
    hidden: false,
    visibility: EVERYONE_VISIBILITY,
    slug: 'episodes',
    icon: null,
    description: 'Every episode, newest first.',
    header: null,
    sections: [
      {
        ...contentSection('all-episodes', { type: 'videos' }, 'All episodes'),
        layout: { type: 'grid', columns: 3 },
        itemCount: 24,
      },
    ],
  };
  return withHomeSections(
    [newest, series, contentSection('start-here', { type: 'start_here' }, 'Start here')],
    [episodes]
  );
}

function blank(): ChannelLayout {
  return withHomeSections([]);
}

const BUILDERS: Readonly<Record<ChannelLayoutTemplate, () => ChannelLayout>> = {
  creator_starter: creatorStarter,
  series_focused: seriesFocused,
  blank,
};

export function channelLayoutTemplate(template: ChannelLayoutTemplate): ChannelLayout {
  return BUILDERS[template]();
}
