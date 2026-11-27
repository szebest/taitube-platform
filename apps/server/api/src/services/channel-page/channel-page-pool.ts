import { type Result, assertNever, isErr, ok } from '@kit/result';
import { PageItemSchema, type PageItemView } from '@vp/api-contracts';
import type {
  ChannelPageSourceRepositoryPort,
  PageItemRef,
  PageItemRow,
  RefsByKey,
} from '@vp/core/repositories';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { z } from 'zod';
import { cdnUrl } from '../video-views';
import { PROBED_TAB_KINDS, type PagePlan, type ProbedTabKind, probeKey } from './channel-page-plan';

export const PagePoolSchema = z.object({
  sections: z.record(z.string(), z.array(PageItemSchema)),
  filled: z.object({
    videos: z.boolean(),
    shorts: z.boolean(),
    posts: z.boolean(),
    playlists: z.boolean(),
  }),
});

export type PagePool = z.infer<typeof PagePoolSchema>;

const POOLED_TYPES = ['videos', 'shorts', 'posts', 'live', 'playlists'] as const;

function toItemView(row: PageItemRow, cdn: CdnBase): PageItemView {
  const thumbnailUrl = row.thumbnailKey === null ? null : cdnUrl(cdn, row.thumbnailKey);
  const base = {
    id: row.id,
    title: row.title,
    thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
  };
  switch (row.kind) {
    case 'video':
      return {
        ...base,
        kind: 'video',
        format: row.format,
        durationMs: row.durationMs,
        viewsCount: row.viewsCount,
        likesCount: row.likesCount,
      };
    case 'post':
      return {
        ...base,
        kind: 'post',
        likesCount: row.likesCount,
        commentsCount: row.commentsCount,
      };
    case 'playlist':
      return { ...base, kind: 'playlist', itemCount: row.itemCount };
    case 'live':
      return {
        ...base,
        kind: 'live',
        status: row.status,
        viewers: row.viewers,
        videoId: row.videoId,
      };
    case 'channel':
      return {
        kind: 'channel',
        channel: {
          id: row.id,
          handle: row.handle,
          displayName: row.title,
          avatarUrl: row.avatarUrl,
        },
      };
    default:
      return assertNever(row, 'PageItemRow');
  }
}

async function collect(
  sources: ChannelPageSourceRepositoryPort,
  channelId: string,
  ownerUserId: string,
  plan: PagePlan,
  now: Date
): Promise<Result<RefsByKey, DatabaseUnavailable>> {
  const calls = [
    ...POOLED_TYPES.filter((type) => plan.pool[type].length > 0).map((type) =>
      sources.pool(channelId, ownerUserId, type, plan.pool[type])
    ),
    ...(plan.playlistItems.length > 0 ? [sources.playlistItems(plan.playlistItems)] : []),
    ...(plan.smart.length > 0 ? [sources.smart(channelId, plan.smart, now)] : []),
  ];
  const answers = await Promise.all(calls);
  const refs: RefsByKey = {};
  for (const answer of answers) {
    if (isErr(answer)) return answer;
    Object.assign(refs, answer.value);
  }
  if (plan.startHere) {
    const pinned = await sources.startHere(channelId, plan.startHere.limit);
    if (isErr(pinned)) return pinned;
    for (const { id, limit } of plan.startHere.sections) refs[id] = pinned.value.slice(0, limit);
  }
  for (const { key, refs: fixed } of plan.fixed) refs[key] = [...fixed];
  return ok(refs);
}

export async function loadPagePool(
  sources: ChannelPageSourceRepositoryPort,
  cdn: CdnBase,
  channelId: string,
  ownerUserId: string,
  plan: PagePlan,
  now: Date
): Promise<Result<PagePool, DatabaseUnavailable>> {
  const collected = await collect(sources, channelId, ownerUserId, plan, now);
  if (isErr(collected)) return collected;
  const refs = collected.value;
  const probes = new Set(PROBED_TAB_KINDS.map(probeKey));
  const wanted = new Map<string, PageItemRef>();
  for (const [key, list] of Object.entries(refs)) {
    if (probes.has(key)) continue;
    for (const ref of list) wanted.set(`${ref.kind}:${ref.id}`, ref);
  }

  const hydrated =
    wanted.size > 0 ? await sources.hydrate([...wanted.values()]) : ok<PageItemRow[]>([]);
  if (isErr(hydrated)) return hydrated;
  const views = new Map(
    hydrated.value.map((row) => [`${row.kind}:${row.id}`, toItemView(row, cdn)])
  );

  const sections: Record<string, PageItemView[]> = {};
  for (const [key, list] of Object.entries(refs)) {
    if (probes.has(key)) continue;
    sections[key] = list.flatMap((ref) => views.get(`${ref.kind}:${ref.id}`) ?? []);
  }
  const has = (kind: ProbedTabKind): boolean => (refs[probeKey(kind)]?.length ?? 0) > 0;
  const filled = {
    videos: has('videos'),
    shorts: has('shorts'),
    posts: has('posts'),
    playlists: has('playlists'),
  };
  return ok({ sections, filled });
}
