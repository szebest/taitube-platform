import { isErr, ok, type Result } from '@kit/result';
import type { LinkedContent, LinkEnds, LinkedItem } from '@vp/api-contracts';
import type {
  ClipRepositoryPort,
  ContentLinkRepositoryPort,
  ContentRefDirectoryPort,
  ResolvedContent,
  TouchingLink,
  WatchHistoryRepositoryPort,
} from '@vp/core/repositories';
import {
  BACKLINK_SAMPLE_SIZE,
  CONTENT_LINK_RELATIONS,
  type ContentLink,
  type ContentLinkRelation,
  type ContentRef,
  clampAnchors,
  contentRefKey,
  NO_ANCHORS,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { ContentLinkCache } from './content-link-cache';
import { toLinkedItem } from './content-link-views';

export interface ContentLinkReadsDeps {
  links: Pick<ContentLinkRepositoryPort, 'touching'>;
  refs: ContentRefDirectoryPort;
  clips: Pick<ClipRepositoryPort, 'listOwnByVideos'>;
  watchHistory: Pick<WatchHistoryRepositoryPort, 'findMany'>;
  cache: ContentLinkCache;
}

type Progress = LinkedItem['progress'];

const ORDER = new Map(CONTENT_LINK_RELATIONS.map((relation, index) => [relation, index]));

const byRelation = (a: ContentLinkRelation, b: ContentLinkRelation) =>
  (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0);

/**
 * The only read path of the link graph: one link read for every ref that is not cached, one
 * hydration of every end found, then what only this viewer has (their playheads and their own clips).
 * Only public ends are ever listed or counted.
 */
export class ContentLinkReads {
  constructor(private readonly deps: ContentLinkReadsDeps) {}

  async forItems(
    refs: readonly ContentRef[],
    viewer: UserContext | null
  ): Promise<Result<LinkedContent[], DatabaseUnavailable>> {
    const unique = [...new Map(refs.map((ref) => [contentRefKey(ref), ref])).values()];
    const touching = await this.touchingOf(unique);
    if (isErr(touching)) return touching;

    const everyRef = [
      ...unique,
      ...[...touching.value.values()].flatMap((found) =>
        found.map(({ direction, link }) => (direction === 'outgoing' ? link.target : link.source))
      ),
    ];
    const resolved = await this.deps.refs.resolve(everyRef);
    if (isErr(resolved)) return resolved;

    const progress = await this.progressOf(viewer, resolved.value);
    if (isErr(progress)) return progress;
    const clips = await this.clipsOf(viewer, unique, resolved.value);
    if (isErr(clips)) return clips;

    return ok(
      unique.map((ref) => {
        const found = touching.value.get(contentRefKey(ref)) ?? [];
        const content = this.contentOf(ref, found, resolved.value, progress.value);
        const own = clips.value.get(contentRefKey(ref));
        return own ? { ...content, incoming: [...content.incoming, own] } : content;
      })
    );
  }

  private async touchingOf(
    refs: readonly ContentRef[]
  ): Promise<Result<Map<string, TouchingLink[]>, DatabaseUnavailable>> {
    const found = new Map<string, TouchingLink[]>();
    const missing: ContentRef[] = [];
    for (const ref of refs) {
      const cached = await this.deps.cache.read(ref);
      if (cached) found.set(contentRefKey(ref), cached);
      else missing.push(ref);
    }
    if (missing.length === 0) return ok(found);

    const read = await this.deps.links.touching(missing);
    if (isErr(read)) return read;
    for (const ref of missing) {
      const own = read.value.filter((entry) => contentRefKey(entry.ref) === contentRefKey(ref));
      found.set(contentRefKey(ref), own);
      await this.deps.cache.write(ref, own);
    }
    return ok(found);
  }

  private contentOf(
    ref: ContentRef,
    found: readonly TouchingLink[],
    resolved: ReadonlyMap<string, ResolvedContent>,
    progress: ReadonlyMap<string, Progress>
  ): LinkedContent {
    const self = resolved.get(contentRefKey(ref));
    const ends = (
      link: ContentLink,
      other: ResolvedContent,
      direction: 'out' | 'in'
    ): LinkEnds => ({
      id: link.id,
      params: link.params,
      anchors:
        direction === 'out'
          ? clampAnchors(link.anchors, self?.durationMs ?? null, other.durationMs)
          : clampAnchors(link.anchors, other.durationMs, self?.durationMs ?? null),
      item: toLinkedItem(other, progressOf(other, progress)),
    });

    const outgoing = new Map<ContentLinkRelation, LinkEnds[]>();
    const incoming = new Map<ContentLinkRelation, LinkEnds[]>();
    for (const { direction, link } of found) {
      const other = resolved.get(
        contentRefKey(direction === 'outgoing' ? link.target : link.source)
      );
      if (!other?.public) continue;
      const bucket = direction === 'outgoing' ? outgoing : incoming;
      const key = link.params.relation;
      bucket.set(key, [
        ...(bucket.get(key) ?? []),
        ends(link, other, direction === 'outgoing' ? 'out' : 'in'),
      ]);
    }

    return {
      ref,
      outgoing: [...outgoing]
        .sort(([a], [b]) => byRelation(a, b))
        .map(([relation, links]) => ({ relation, links })),
      incoming: [...incoming]
        .sort(([a], [b]) => byRelation(a, b))
        .map(([relation, links]) => ({
          relation,
          count: links.length,
          samples: links.slice(0, BACKLINK_SAMPLE_SIZE),
        })),
    };
  }

  private async progressOf(
    viewer: UserContext | null,
    resolved: ReadonlyMap<string, ResolvedContent>
  ): Promise<Result<Map<string, Progress>, DatabaseUnavailable>> {
    const found = new Map<string, Progress>();
    if (!viewer) return ok(found);
    const ids = [
      ...new Set(
        [...resolved.values()].flatMap(({ mediaVideoId }) => (mediaVideoId ? [mediaVideoId] : []))
      ),
    ];
    if (ids.length === 0) return ok(found);
    const history = await this.deps.watchHistory.findMany(viewer.id, ids);
    if (isErr(history)) return history;
    for (const { videoId, progressSeconds, durationSeconds } of history.value) {
      found.set(videoId, { progressSeconds, durationSeconds });
    }
    return ok(found);
  }

  /** The viewer's own clips of each video asked for, as one `clip_of` group per video. */
  private async clipsOf(
    viewer: UserContext | null,
    refs: readonly ContentRef[],
    resolved: ReadonlyMap<string, ResolvedContent>
  ): Promise<Result<Map<string, LinkedContent['incoming'][number]>, DatabaseUnavailable>> {
    const groups = new Map<string, LinkedContent['incoming'][number]>();
    const videoIds = refs.flatMap((ref) => (ref.type === 'video' ? [ref.id] : []));
    if (!viewer || videoIds.length === 0) return ok(groups);
    const clips = await this.deps.clips.listOwnByVideos(viewer.id, videoIds);
    if (isErr(clips)) return clips;
    for (const clip of clips.value) {
      const key = contentRefKey({ type: 'video', id: clip.videoId });
      const held = groups.get(key);
      const sample: LinkEnds = {
        id: clip.id,
        params: { relation: 'clip_of' },
        anchors: { ...NO_ANCHORS, targetStartMs: clip.startMs, targetEndMs: clip.endMs },
        item: {
          ref: { type: 'clip', id: clip.id },
          title: clip.title,
          channelId: resolved.get(key)?.channelId ?? '',
          mediaVideoId: clip.videoId,
          durationMs: clip.endMs - clip.startMs,
          format: null,
          progress: null,
        },
      };
      groups.set(key, {
        relation: 'clip_of',
        count: (held?.count ?? 0) + 1,
        samples: [...(held?.samples ?? []), sample].slice(0, BACKLINK_SAMPLE_SIZE),
      });
    }
    return ok(groups);
  }
}

function progressOf(content: ResolvedContent, progress: ReadonlyMap<string, Progress>): Progress {
  return (content.mediaVideoId && progress.get(content.mediaVideoId)) || null;
}
