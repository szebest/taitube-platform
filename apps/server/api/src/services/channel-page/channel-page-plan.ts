import { MS_PER_DAY } from '@kit/primitives';
import { assertNever } from '@kit/result';
import type {
  PageItemRef,
  PlaylistItemsRequest,
  PoolRequest,
  PoolSourceType,
  SmartRequest,
} from '@vp/core/repositories';
import {
  type ChannelLayout,
  type ContentSection,
  LAYOUT_LIMITS,
  type LayoutSection,
  type LayoutTab,
  type SectionFilters,
  type ViewerAudience,
  tabSections,
} from '@vp/domain';
import { isShownInLocale, isShownToAudience } from '@vp/domain-rules';

export const PROBED_TAB_KINDS = ['videos', 'shorts', 'posts', 'playlists'] as const;
export type ProbedTabKind = (typeof PROBED_TAB_KINDS)[number];

export const probeKey = (kind: ProbedTabKind): string => `tab:${kind}`;

export interface PagePlan {
  pool: Record<PoolSourceType, PoolRequest[]>;
  playlistItems: PlaylistItemsRequest[];
  smart: SmartRequest[];
  startHere: { limit: number; sections: { id: string; limit: number }[] } | null;
  fixed: { key: string; refs: PageItemRef[] }[];
}

export interface PlanInput {
  layout: ChannelLayout;
  audience: ViewerAudience;
  locales: readonly string[];
  now: Date;
}

/** The tabs and sections this audience and locale may see at all; the window is judged at read. */
export function shownTabs(
  layout: ChannelLayout,
  audience: ViewerAudience,
  locales: readonly string[]
): LayoutTab[] {
  return layout.tabs.filter(
    ({ hidden, visibility }) =>
      !hidden && isShownToAudience(visibility, audience) && isShownInLocale(visibility, locales)
  );
}

export function shownSections(
  tab: LayoutTab,
  audience: ViewerAudience,
  locales: readonly string[]
): LayoutSection[] {
  return tabSections(tab).filter(
    ({ visibility }) =>
      isShownToAudience(visibility, audience) && isShownInLocale(visibility, locales)
  );
}

function wantsPool({ sort, filters }: ContentSection): boolean {
  return sort === 'random' || filters.hideWatched;
}

function poolLimit(section: ContentSection): number {
  return wantsPool(section) ? LAYOUT_LIMITS.poolSize : section.itemCount;
}

function windowOf(filters: SectionFilters, now: Date): { since: Date | null; until: Date | null } {
  const range = filters.dateRange;
  if (range === null) return { since: null, until: null };
  switch (range.type) {
    case 'absolute':
      return {
        since: range.from === null ? null : new Date(range.from),
        until: range.to === null ? null : new Date(range.to),
      };
    case 'last_days':
      return { since: new Date(now.getTime() - range.days * MS_PER_DAY), until: null };
    default:
      return assertNever(range, 'SectionDateRange');
  }
}

function poolRequest(section: ContentSection, now: Date): PoolRequest {
  const { filters, sort } = section;
  return {
    key: section.id,
    sort: sort === 'random' || sort === 'manual' ? 'newest' : sort,
    limit: poolLimit(section),
    tags: filters.tags,
    ...windowOf(filters, now),
    minDurationSec: filters.duration?.minSeconds ?? null,
    maxDurationSec: filters.duration?.maxSeconds ?? null,
  };
}

function isProbed(kind: string): kind is ProbedTabKind {
  return PROBED_TAB_KINDS.some((probed) => probed === kind);
}

function probeRequest(kind: ProbedTabKind): PoolRequest {
  return {
    key: probeKey(kind),
    sort: 'newest',
    limit: 1,
    tags: [],
    since: null,
    until: null,
    minDurationSec: null,
    maxDurationSec: null,
  };
}

/**
 * Groups every section's source by type, so the resolver asks each type once: one request per
 * section inside it, and a one-item probe for each fixed tab that decides whether the tab shows.
 */
export function planPage({ layout, audience, locales, now }: PlanInput): PagePlan {
  const plan: PagePlan = {
    pool: { videos: [], shorts: [], posts: [], live: [], playlists: [] },
    playlistItems: [],
    smart: [],
    startHere: null,
    fixed: [],
  };
  const tabs = shownTabs(layout, audience, locales);
  for (const tab of tabs) {
    const { kind } = tab;
    if (isProbed(kind)) {
      const key = probeKey(kind);
      if (!plan.pool[kind].some((request) => request.key === key)) {
        plan.pool[kind].push(probeRequest(kind));
      }
    }
    for (const section of shownSections(tab, audience, locales)) {
      if (section.kind === 'featured_channels') {
        plan.fixed.push({
          key: section.id,
          refs: section.channelIds.map((id) => ({ kind: 'channel' as const, id })),
        });
        continue;
      }
      if (section.kind !== 'content') continue;
      const { source } = section;
      switch (source.type) {
        case 'videos':
        case 'shorts':
        case 'posts':
        case 'live':
        case 'playlists':
          plan.pool[source.type].push(poolRequest(section, now));
          break;
        case 'playlist':
          plan.playlistItems.push({
            key: section.id,
            playlistId: source.playlistId,
            limit: poolLimit(section),
          });
          break;
        case 'smart_playlist':
          plan.smart.push({ key: section.id, rules: source.rules, limit: poolLimit(section) });
          break;
        case 'picked':
          plan.fixed.push({ key: section.id, refs: source.items });
          break;
        case 'start_here': {
          const limit = poolLimit(section);
          const held = plan.startHere?.sections ?? [];
          plan.startHere = {
            limit: Math.max(limit, plan.startHere?.limit ?? 0),
            sections: [...held, { id: section.id, limit }],
          };
          break;
        }
        default:
          return assertNever(source, 'SectionSource');
      }
    }
  }
  return plan;
}
