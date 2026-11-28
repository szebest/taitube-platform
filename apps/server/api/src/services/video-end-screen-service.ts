import { andThen, andThenAsync, err, isErr, ok, type Result } from '@kit/result';
import type {
  EndScreenItemView,
  EndScreenRead,
  EndScreenResource,
  ReplaceEndScreenBody,
} from '@vp/api-contracts';
import type {
  ContentLinkRepositoryPort,
  ContentRefDirectoryPort,
  ResolvedContent,
  VideoEndScreenRepositoryPort,
  VideoRepository,
  WatchHistoryRepositoryPort,
} from '@vp/core/repositories';
import { type ContentRef, contentRefKey, type EndScreenItem, isWatchCompleted } from '@vp/domain';
import {
  decideEndScreen,
  decideVideoEditAccess,
  decideVideoRead,
  type EndScreenInvalid,
  endScreenInvalid,
  publicReadFailure,
  type ReadVideoFailure,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { canSeeContent } from './content-link-views';

export interface VideoEndScreenServiceDeps {
  endScreens: VideoEndScreenRepositoryPort;
  videos: Pick<VideoRepository, 'findById'>;
  links: Pick<ContentLinkRepositoryPort, 'touching'>;
  refs: ContentRefDirectoryPort;
  watchHistory: Pick<WatchHistoryRepositoryPort, 'findMany'>;
}

export type ReadEndScreenFailure = ReadVideoFailure | DatabaseUnavailable;
export type ReplaceEndScreenFailure = ReadEndScreenFailure | EndScreenInvalid | VersionConflict;

const NEXT_EPISODE_WALK = 50;

/**
 * A video's end screen: up to four picks of the creator, the viewer's own next episode, and a
 * fallback flag for the client's related videos. A pick the viewer cannot see is left out.
 */
export class VideoEndScreenService {
  constructor(private readonly deps: VideoEndScreenServiceDeps) {}

  async read(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<EndScreenRead, ReadEndScreenFailure>> {
    const video = await this.deps.videos.findById(videoId);
    return andThenAsync(
      video,
      async (found): Promise<Result<EndScreenRead, ReadEndScreenFailure>> => {
        const readable = decideVideoRead({ viewer, video: found, videoId });
        if (isErr(readable)) return err(publicReadFailure(readable.error));
        const stored = await this.deps.endScreens.find(videoId);
        return andThenAsync(
          stored,
          async (screen): Promise<Result<EndScreenRead, ReadEndScreenFailure>> => {
            if (!screen) return ok({ endScreen: null, fallback: true });
            const items = await this.viewItems(viewer, videoId, screen.items);
            return andThen(items, (shown) =>
              ok({
                endScreen: {
                  layout: screen.layout,
                  startsAtMs: screen.startsAtMs,
                  showSubscribe: screen.showSubscribe,
                  items: shown,
                },
                fallback: shown.length === 0,
              })
            );
          }
        );
      }
    );
  }

  async readForEditing(
    editor: UserContext,
    videoId: string
  ): Promise<Result<EndScreenResource | null, ReadEndScreenFailure>> {
    const video = await this.deps.videos.findById(videoId);
    return andThenAsync(
      video,
      async (found): Promise<Result<EndScreenResource | null, ReadEndScreenFailure>> => {
        const allowed = decideVideoEditAccess({ editor, video: found, videoId });
        if (isErr(allowed)) return allowed;
        return this.deps.endScreens.find(videoId);
      }
    );
  }

  async replace(
    editor: UserContext,
    videoId: string,
    body: ReplaceEndScreenBody
  ): Promise<Result<EndScreenResource, ReplaceEndScreenFailure>> {
    const video = await this.deps.videos.findById(videoId);
    return andThenAsync(
      video,
      async (found): Promise<Result<EndScreenResource, ReplaceEndScreenFailure>> => {
        const allowed = decideVideoEditAccess({ editor, video: found, videoId });
        if (isErr(allowed)) return allowed;

        const decided = decideEndScreen({
          items: body.items,
          startsAtMs: body.startsAtMs,
          durationMs: allowed.value.durationMs ?? 0,
        });
        if (isErr(decided)) return decided;

        const linkable = await this.allLinkable(body.items, allowed.value.channelId);
        if (isErr(linkable)) return linkable;
        if (!linkable.value) return err(endScreenInvalid('items'));

        const saved = await this.deps.endScreens.replace(
          {
            videoId,
            layout: body.layout,
            startsAtMs: body.startsAtMs,
            items: body.items,
            showSubscribe: body.showSubscribe,
          },
          body.version
        );
        return andThen(saved, (screen) => (screen ? ok(screen) : err(versionConflict(videoId))));
      }
    );
  }

  private async allLinkable(
    items: readonly EndScreenItem[],
    channelId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const refs = items.flatMap((item) => (item.type === 'content' ? [item.ref] : []));
    if (refs.length === 0) return ok(true);
    const resolved = await this.deps.refs.resolve(refs);
    return andThen(resolved, (contents) =>
      ok(
        refs.every((ref) => {
          const content = contents.get(contentRefKey(ref));
          return content !== undefined && (content.public || content.channelId === channelId);
        })
      )
    );
  }

  private async viewItems(
    viewer: UserContext | null,
    videoId: string,
    items: readonly EndScreenItem[]
  ): Promise<Result<EndScreenItemView[], DatabaseUnavailable>> {
    const refs = items.flatMap((item) => (item.type === 'content' ? [item.ref] : []));
    const resolved = await this.deps.refs.resolve(refs);
    if (isErr(resolved)) return resolved;

    const shown: EndScreenItemView[] = [];
    for (const item of items) {
      switch (item.type) {
        case 'content': {
          const content = resolved.value.get(contentRefKey(item.ref));
          if (content && canSeeContent(null, content))
            shown.push(viewOf(item.ref, content, 'content'));
          break;
        }
        case 'channel_tab':
        case 'subscribe':
          shown.push(item);
          break;
        case 'next_episode': {
          const next = await this.nextEpisode(viewer, videoId);
          if (isErr(next)) return next;
          if (next.value) shown.push(viewOf(next.value.ref, next.value, 'next_episode'));
          break;
        }
      }
    }
    return ok(shown);
  }

  /**
   * The video whose `previous` link names this one, then on along the chain past the episodes
   * the viewer finished, up to 50 steps; the first public one is the next episode.
   */
  private async nextEpisode(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<ResolvedContent | null, DatabaseUnavailable>> {
    let current: ContentRef = { type: 'video', id: videoId };
    for (let step = 0; step < NEXT_EPISODE_WALK; step += 1) {
      const touching = await this.deps.links.touching([current]);
      if (isErr(touching)) return touching;
      const following = touching.value.find(
        ({ direction, link }) => direction === 'incoming' && link.params.relation === 'previous'
      );
      if (!following) return ok(null);
      const next = following.link.source;
      const resolved = await this.deps.refs.resolve([next]);
      if (isErr(resolved)) return resolved;
      const content = resolved.value.get(contentRefKey(next));
      if (!content?.public) return ok(null);

      const finished = await this.finished(viewer, content);
      if (isErr(finished)) return finished;
      if (!finished.value) return ok(content);
      current = next;
    }
    return ok(null);
  }

  private async finished(
    viewer: UserContext | null,
    content: ResolvedContent
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!viewer || !content.mediaVideoId) return ok(false);
    const history = await this.deps.watchHistory.findMany(viewer.id, [content.mediaVideoId]);
    return andThen(history, ([progress]) => ok(progress ? isWatchCompleted(progress) : false));
  }
}

function viewOf(
  ref: ContentRef,
  content: ResolvedContent,
  type: 'content' | 'next_episode'
): EndScreenItemView {
  return { type, ref, title: content.title, mediaVideoId: content.mediaVideoId };
}
