import type { SmartPlaylistRules } from './smart-playlist';

export const CHANNEL_LAYOUT_VERSION = 1;

export const LAYOUT_LIMITS = {
  tabs: 10,
  customTabs: 4,
  sectionsPerTab: 20,
  sections: 60,
  pickedItems: 24,
  documentBytes: 128 * 1024,
  richTextChars: 8000,
  richTextImages: 6,
  links: 8,
  featuredChannels: 12,
  tabTitle: 24,
  tabDescription: 280,
  tags: 5,
  itemCount: 24,
  poolSize: 48,
} as const;

export type LayoutLimit =
  | 'tabs'
  | 'custom_tabs'
  | 'sections_per_tab'
  | 'sections'
  | 'picked_items'
  | 'document_bytes';

export const LAYOUT_AUDIENCES = ['everyone', 'visitors', 'subscribers', 'signed_in'] as const;
export type LayoutAudience = (typeof LAYOUT_AUDIENCES)[number];

export const VIEWER_AUDIENCES = ['guest', 'member', 'subscriber'] as const;
export type ViewerAudience = (typeof VIEWER_AUDIENCES)[number];

export const BUILT_IN_TAB_KINDS = [
  'home',
  'videos',
  'shorts',
  'posts',
  'playlists',
  'about',
] as const;
export type BuiltInTabKind = (typeof BUILT_IN_TAB_KINDS)[number];

export const PINNED_TAB_KINDS = ['home', 'about'] as const satisfies readonly BuiltInTabKind[];

export const RESERVED_TAB_SLUGS: readonly string[] = [
  ...BUILT_IN_TAB_KINDS,
  'live',
  'streams',
  'community',
  'featured',
  'search',
  'channels',
  'settings',
  'subscribe',
  'playlist',
  'preview',
  'page',
  'new',
  'edit',
];

export const SECTION_SOURCE_TYPES = [
  'videos',
  'shorts',
  'posts',
  'live',
  'playlists',
  'playlist',
  'picked',
  'start_here',
  'smart_playlist',
] as const;

export const PAGE_SOURCE_TYPES = [...SECTION_SOURCE_TYPES, 'channels'] as const;
export type PageSourceType = (typeof PAGE_SOURCE_TYPES)[number];

export const SECTION_SORTS = [
  'newest',
  'popular',
  'oldest',
  'most_liked',
  'manual',
  'random',
] as const;
export type SectionSort = (typeof SECTION_SORTS)[number];

export const SECTION_LAYOUT_TYPES = ['shelf', 'grid', 'list', 'hero', 'masonry'] as const;
export const SECTION_DENSITIES = ['compact', 'comfortable'] as const;
export type SectionDensity = (typeof SECTION_DENSITIES)[number];

export const PICKED_ITEM_KINDS = ['video', 'playlist', 'post'] as const;
export type PickedItemKind = (typeof PICKED_ITEM_KINDS)[number];

export const GRID_COLUMNS = { min: 2, max: 6 } as const;

export type LocalizedText = { default: string } & Record<string, string>;

export interface LayoutVisibility {
  audience: LayoutAudience;
  from: string | null;
  to: string | null;
  locales: string[];
}

export interface SectionPresentation {
  title: LocalizedText | null;
  subtitle: LocalizedText | null;
  background: string | null;
  accent: string | null;
  density: SectionDensity;
  show: { duration: boolean; views: boolean; date: boolean };
}

export interface PickedItem {
  kind: PickedItemKind;
  id: string;
}

export type SectionSource =
  | { type: 'videos' }
  | { type: 'shorts' }
  | { type: 'posts' }
  | { type: 'live' }
  | { type: 'playlists' }
  | { type: 'playlist'; playlistId: string }
  | { type: 'picked'; items: PickedItem[] }
  | { type: 'start_here' }
  | { type: 'smart_playlist'; rules: SmartPlaylistRules };

export type SectionDateRange =
  | { type: 'absolute'; from: string | null; to: string | null }
  | { type: 'last_days'; days: number };

export interface SectionFilters {
  tags: string[];
  dateRange: SectionDateRange | null;
  duration: { minSeconds: number | null; maxSeconds: number | null } | null;
  hideWatched: boolean;
}

export type SectionLayout =
  | { type: 'shelf' }
  | { type: 'grid'; columns: number }
  | { type: 'list' }
  | { type: 'hero' }
  | { type: 'masonry' };

export interface ContentSection {
  kind: 'content';
  id: string;
  source: SectionSource;
  filters: SectionFilters;
  sort: SectionSort;
  layout: SectionLayout;
  itemCount: number;
  seeAll: string | null;
  presentation: SectionPresentation;
  visibility: LayoutVisibility;
  hideWhenEmpty: boolean;
}

export interface RichTextSection {
  kind: 'rich_text';
  id: string;
  body: string;
  presentation: SectionPresentation;
  visibility: LayoutVisibility;
}

export interface LinksSection {
  kind: 'links';
  id: string;
  links: { label: string; url: string }[];
  presentation: SectionPresentation;
  visibility: LayoutVisibility;
}

export interface FeaturedChannelsSection {
  kind: 'featured_channels';
  id: string;
  channelIds: string[];
  presentation: SectionPresentation;
  visibility: LayoutVisibility;
}

export type LayoutSection =
  | ContentSection
  | RichTextSection
  | LinksSection
  | FeaturedChannelsSection;

interface TabBase {
  id: string;
  title: string;
  hidden: boolean;
  visibility: LayoutVisibility;
}

export interface HomeTab extends TabBase {
  kind: 'home';
  sections: LayoutSection[];
}

export interface FixedTab extends TabBase {
  kind: Exclude<BuiltInTabKind, 'home'>;
}

export interface CustomTab extends TabBase {
  kind: 'custom';
  slug: string;
  icon: string | null;
  description: string | null;
  header: string | null;
  sections: LayoutSection[];
}

export type LayoutTab = HomeTab | FixedTab | CustomTab;

export type ChannelLayout = {
  schemaVersion: typeof CHANNEL_LAYOUT_VERSION;
  landing: { visitor: string; subscriber: string };
  tabs: LayoutTab[];
};

export function tabSections(tab: LayoutTab): LayoutSection[] {
  return tab.kind === 'home' || tab.kind === 'custom' ? tab.sections : [];
}

export function tabSlug(tab: LayoutTab): string {
  return tab.kind === 'custom' ? tab.slug : tab.kind;
}

const EVERYONE: LayoutVisibility = { audience: 'everyone', from: null, to: null, locales: [] };

const PRESENTATION: SectionPresentation = {
  title: null,
  subtitle: null,
  background: null,
  accent: null,
  density: 'comfortable',
  show: { duration: true, views: true, date: true },
};

const NO_FILTERS: SectionFilters = {
  tags: [],
  dateRange: null,
  duration: null,
  hideWatched: false,
};

const TAB_TITLES: Readonly<Record<BuiltInTabKind, string>> = {
  home: 'Home',
  videos: 'Videos',
  shorts: 'Shorts',
  posts: 'Posts',
  playlists: 'Playlists',
  about: 'About',
};

function contentSection(id: string, source: SectionSource, title: string): ContentSection {
  return {
    kind: 'content',
    id,
    source,
    filters: NO_FILTERS,
    sort: source.type === 'start_here' ? 'manual' : 'newest',
    layout: { type: 'shelf' },
    itemCount: 12,
    seeAll: null,
    presentation: { ...PRESENTATION, title: { default: title } },
    visibility: EVERYONE,
    hideWhenEmpty: true,
  };
}

/** What a channel that never published a layout shows: the fixed tabs and a Home of two shelves. */
export function defaultChannelLayout(): ChannelLayout {
  const fixed = (kind: Exclude<BuiltInTabKind, 'home'>): FixedTab => ({
    kind,
    id: kind,
    title: TAB_TITLES[kind],
    hidden: false,
    visibility: EVERYONE,
  });
  return {
    schemaVersion: CHANNEL_LAYOUT_VERSION,
    landing: { visitor: 'home', subscriber: 'home' },
    tabs: [
      {
        kind: 'home',
        id: 'home',
        title: TAB_TITLES.home,
        hidden: false,
        visibility: EVERYONE,
        sections: [
          { ...contentSection('start-here', { type: 'start_here' }, 'Start here'), seeAll: null },
          { ...contentSection('latest', { type: 'videos' }, 'Latest uploads'), seeAll: 'videos' },
        ],
      },
      fixed('videos'),
      fixed('shorts'),
      fixed('posts'),
      fixed('playlists'),
      fixed('about'),
    ],
  };
}

export type StoredLayout = { schemaVersion: number } & Record<string, unknown>;

type LayoutMigration = (document: StoredLayout) => StoredLayout;

/** One step per old version, each returning the next; version 1 is the first, so none exist yet. */
const LAYOUT_MIGRATIONS: Readonly<Record<number, LayoutMigration>> = {};

function isStoredLayout(raw: unknown): raw is StoredLayout {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    !Array.isArray(raw) &&
    typeof Reflect.get(raw, 'schemaVersion') === 'number'
  );
}

/**
 * Brings a stored document to the current version, or answers null for one that is not a layout
 * or comes from a newer version than this build knows.
 */
export function migrateLayout(
  raw: unknown,
  migrations: Readonly<Record<number, LayoutMigration>> = LAYOUT_MIGRATIONS
): StoredLayout | null {
  if (!isStoredLayout(raw)) return null;
  let document: StoredLayout = raw;
  while (document.schemaVersion < CHANNEL_LAYOUT_VERSION) {
    const step = migrations[document.schemaVersion];
    if (!step) return null;
    const next = step(document);
    if (next.schemaVersion <= document.schemaVersion) return null;
    document = next;
  }
  return document.schemaVersion === CHANNEL_LAYOUT_VERSION ? document : null;
}
