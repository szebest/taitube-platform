import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, isErr, ok } from '@kit/result';
import type { PlaylistView } from '@vp/api-contracts';
import type { PlaylistRepositoryPort } from '@vp/core/repositories';
import { nextEpisode, percentWatched } from '@vp/domain';
import { type PlaylistNotFound, type ShareLinkExpired, playlistNotFound } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { ShareGrant, UserContext } from '@vp/permissions';
import { toPlaylistView } from './library-views';
import type { PlaylistSharingService } from './playlist-sharing-service';
import type { PlaylistStatsRecorder } from './playlist-stats-recorder';
import type { SmartPlaylistReader } from './smart-playlist-reader';
import type { SpriteGeometry } from './video-views';
import type { ViewerProgress } from './viewer-progress';

export interface PlaylistReaderDeps {
  playlists: Pick<PlaylistRepositoryPort, 'findDetail'>;
  viewerProgress: ViewerProgress;
  smart: Pick<SmartPlaylistReader, 'page'>;
  sharing: Pick<PlaylistSharingService, 'shareOf'>;
  recorder: Pick<PlaylistStatsRecorder, 'opened' | 'linkOpened'>;
  cdn: CdnBase;
  sprite: SpriteGeometry;
}

/** What a read of one playlist carries beside the caller: a share token and the tab's session key. */
export interface PlaylistAccess {
  readonly shareToken: string | null;
  readonly sessionKey: string | null;
}

export type ReadPlaylistFailure = PlaylistNotFound | DatabaseUnavailable;

/**
 * One playlist as a viewer reads it: its stored items, or what a smart one computes now, with the
 * viewer's progress on each and a series' episodes.
 */
export class PlaylistReader {
  constructor(private readonly deps: PlaylistReaderDeps) {}

  async get(
    viewer: UserContext | null,
    playlistId: string
  ): Promise<Result<PlaylistView, ReadPlaylistFailure>> {
    return await this.detail(viewer, playlistId);
  }

  /** A read of the page: through a share link if one is held, counting the open for anyone but the owner. */
  async open(
    viewer: UserContext | null,
    playlistId: string,
    access: PlaylistAccess
  ): Promise<Result<PlaylistView, ReadPlaylistFailure | ShareLinkExpired>> {
    const share = await this.deps.sharing.shareOf(access.shareToken, playlistId);
    if (isErr(share)) return share;
    const view = await this.detail(viewer, playlistId, share.value?.grant ?? null);
    if (isErr(view)) return view;

    const viewerKey = viewer?.id ?? access.sessionKey;
    if (view.value.ownerId !== viewer?.id) await this.deps.recorder.opened(playlistId, viewerKey);
    if (share.value) await this.deps.recorder.linkOpened(share.value.link, viewerKey);
    return view;
  }

  private async detail(
    viewer: UserContext | null,
    playlistId: string,
    share: ShareGrant | null = null
  ): Promise<Result<PlaylistView, ReadPlaylistFailure>> {
    const found = await this.deps.playlists.findDetail(playlistId, viewer, share);
    if (isErr(found)) return found;
    if (!found.value) return err(playlistNotFound(playlistId));

    const { rules } = found.value.playlist;
    const computed =
      rules === null
        ? ok(undefined)
        : await this.deps.smart.page({ id: playlistId, rules }, viewer, {
            cursor: null,
            limit: rules.limit,
          });
    if (isErr(computed)) return computed;
    const view = toPlaylistView(
      found.value,
      this.deps.cdn,
      this.deps.sprite,
      computed.value?.slice(0, rules?.limit).map(({ item }) => item)
    );
    const videos = await this.deps.viewerProgress.attach(
      viewer,
      view.items.map((item) => item.video)
    );
    const items = view.items.map((item, index) => ({
      ...item,
      video: videos[index] ?? item.video,
    }));
    return ok(
      view.kind === 'series'
        ? { ...view, ...seriesProgress(view.items.length, items, viewer) }
        : { ...view, items }
    );
  }
}

type PlaylistItems = PlaylistView['items'];

/** A series reads like a list of episodes: numbered for everyone, with progress and "Continue" for a signed-in viewer. */
function seriesProgress(
  count: number,
  items: PlaylistItems,
  viewer: UserContext | null
): Pick<PlaylistView, 'items' | 'nextEpisodeVideoId'> {
  const episodes = items.map((item) => {
    const watched = item.video.viewer;
    return {
      ...item,
      episode: item.position + 1,
      progress: watched ? percentWatched(watched.progressSeconds, item.video.durationMs) : null,
    };
  });
  if (!viewer || count === 0) return { items: episodes, nextEpisodeVideoId: null };

  return {
    items: episodes,
    nextEpisodeVideoId: nextEpisode(
      episodes.map(({ videoId, progress, video }) => ({
        videoId,
        percent: progress,
        watchedAt: video.viewer ? new Date(video.viewer.watchedAt) : null,
      }))
    ),
  };
}
