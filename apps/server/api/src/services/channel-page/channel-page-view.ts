import { type Result, assertNever, err, ok } from '@kit/result';
import type { ChannelPageView, PageItemView, ResolvedSectionView } from '@vp/api-contracts';
import {
  type ChannelLayout,
  type LayoutSection,
  type LayoutTab,
  platformOfUrl,
  tabSections,
  tabSlug,
} from '@vp/domain';
import {
  type ChannelNotFound,
  type LayoutViewer,
  channelNotFound,
  isShownTo,
  shuffledBySeed,
} from '@vp/domain-rules';
import type { PagePool } from './channel-page-pool';

export interface PageSelection {
  tabs: LayoutTab[];
  tab: LayoutTab;
  landing: LayoutTab;
}

type TabSummary = ChannelPageView['tabs'][number];

function summaryOf(tab: LayoutTab): TabSummary {
  return {
    id: tab.id,
    kind: tab.kind,
    title: tab.title,
    slug: tabSlug(tab),
    icon: tab.kind === 'custom' ? tab.icon : null,
  };
}

function hasContent(tab: LayoutTab, pool: PagePool): boolean {
  switch (tab.kind) {
    case 'videos':
    case 'shorts':
    case 'posts':
    case 'playlists':
      return pool.filled[tab.kind];
    case 'home':
    case 'about':
    case 'custom':
      return true;
    default:
      return assertNever(tab, 'LayoutTab');
  }
}

export function selectTab(
  layout: ChannelLayout,
  pool: PagePool,
  viewer: LayoutViewer,
  requested: string | undefined,
  idOrHandle: string
): Result<PageSelection, ChannelNotFound> {
  const tabs = layout.tabs.filter(
    (tab) => !tab.hidden && isShownTo(tab.visibility, viewer) && hasContent(tab, pool)
  );
  const home = tabs.find(({ kind }) => kind === 'home') ?? tabs[0];
  if (!home) return err(channelNotFound(idOrHandle));
  const landingId =
    viewer.audience === 'subscriber' ? layout.landing.subscriber : layout.landing.visitor;
  const landing = tabs.find(({ id }) => id === landingId) ?? home;
  if (requested === undefined) return ok({ tabs, tab: landing, landing });
  const tab = tabs.find((candidate) => tabSlug(candidate) === requested);
  return tab ? ok({ tabs, tab, landing }) : err(channelNotFound(`${idOrHandle}/${requested}`));
}

function sectionsOf(tab: LayoutTab, viewer: LayoutViewer): LayoutSection[] {
  return tabSections(tab).filter(({ visibility }) => isShownTo(visibility, viewer));
}

export function watchCandidates(tab: LayoutTab, pool: PagePool, viewer: LayoutViewer): string[] {
  return sectionsOf(tab, viewer).flatMap((section) =>
    section.kind === 'content' && section.filters.hideWatched
      ? (pool.sections[section.id] ?? []).flatMap((item) =>
          item.kind === 'video' ? [item.id] : []
        )
      : []
  );
}

interface ResolveContext {
  layout: ChannelLayout;
  pool: PagePool;
  seed: string;
  watched: ReadonlySet<string>;
}

function resolveSection(
  section: LayoutSection,
  { layout, pool, seed, watched }: ResolveContext
): ResolvedSectionView | null {
  const { id, presentation } = section;
  switch (section.kind) {
    case 'content': {
      const own = pool.sections[id] ?? [];
      const unwatched = section.filters.hideWatched
        ? own.filter((item) => !(item.kind === 'video' && watched.has(item.id)))
        : own;
      const ordered =
        section.sort === 'random' ? shuffledBySeed(unwatched, `${seed}:${id}`) : unwatched;
      const items = ordered.slice(0, section.itemCount);
      if (items.length === 0 && (section.hideWhenEmpty || section.filters.hideWatched)) return null;
      const target = layout.tabs.find((tab) => tab.id === section.seeAll);
      return {
        kind: 'content',
        id,
        presentation,
        layout: section.layout,
        seeAll: target ? tabSlug(target) : null,
        items,
      };
    }
    case 'rich_text':
      return { kind: 'rich_text', id, presentation, body: section.body };
    case 'links':
      return {
        kind: 'links',
        id,
        presentation,
        links: section.links.map((link) => ({ ...link, platform: platformOfUrl(link.url) })),
      };
    case 'featured_channels': {
      const items: PageItemView[] = pool.sections[id] ?? [];
      return { kind: 'featured_channels', id, presentation, items };
    }
    default:
      return assertNever(section, 'LayoutSection');
  }
}

export function assemblePage(input: {
  channelId: string;
  revision: number | null;
  selection: PageSelection;
  context: ResolveContext;
  viewer: LayoutViewer;
}): Omit<ChannelPageView, 'images'> {
  const { channelId, revision, selection, context, viewer } = input;
  const { tab } = selection;
  return {
    channelId,
    revision,
    seed: context.seed,
    landing: tabSlug(selection.landing),
    tabs: selection.tabs.map(summaryOf),
    tab: {
      ...summaryOf(tab),
      description: tab.kind === 'custom' ? tab.description : null,
      header: tab.kind === 'custom' ? tab.header : null,
      sections: sectionsOf(tab, viewer).flatMap(
        (section) => resolveSection(section, context) ?? []
      ),
    },
  };
}
