import type { DatabaseUnavailable } from '@kit/errors';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, assertNever, err, isErr, map, ok } from '@kit/result';
import type { FollowedPlaylistView, PlaylistView } from '@vp/api-contracts';
import type {
  FollowedPlaylist,
  PlaylistLibraryRepositoryPort,
  PlaylistRepositoryPort,
} from '@vp/core/repositories';
import type { SeatedPlaylist } from '@vp/domain';
import {
  type ManagePlaylistFailure,
  type PlaylistNotFound,
  type PlaylistNotSmart,
  type PlaylistPinLimit,
  decidePlaylistFollow,
  decidePlaylistFork,
  decidePlaylistFreeze,
  decidePlaylistPin,
  playlistNotFound,
  playlistPinLimit,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import type { PlaylistService } from './playlist-service';
import type { PlaylistStatsRecorder } from './playlist-stats-recorder';
import type { SmartPlaylistReader } from './smart-playlist-reader';
import { cdnUrl } from './video-views';

export interface PlaylistLibraryServiceDeps {
  playlists: Pick<PlaylistRepositoryPort, 'findSeated'>;
  library: PlaylistLibraryRepositoryPort;
  views: Pick<PlaylistService, 'get'>;
  smart: Pick<SmartPlaylistReader, 'page'>;
  recorder: Pick<PlaylistStatsRecorder, 'record'>;
  paginator: Paginator;
  cdn: CdnBase;
  newId: () => string;
  now: () => number;
}

type Refused = ManagePlaylistFailure | DatabaseUnavailable;
type Decide<F> = (input: {
  actor: UserContext;
  playlist: SeatedPlaylist | null;
  playlistId: string;
}) => Result<SeatedPlaylist, F>;

/** What a user keeps of playlists beside their own items: shelves, follows, forks and frozen copies. */
export class PlaylistLibraryService {
  constructor(private readonly deps: PlaylistLibraryServiceDeps) {}

  async pin(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<void, Refused | PlaylistPinLimit>> {
    const playlist = await this.decided(actor, playlistId, decidePlaylistPin);
    if (isErr(playlist)) return playlist;
    const pinned = await this.deps.library.pin(actor.id, playlistId, new Date(this.deps.now()));
    if (isErr(pinned)) return pinned;
    switch (pinned.value) {
      case 'pinned':
        return ok();
      case 'full':
        return err(playlistPinLimit(playlistId));
      case 'missing':
        return err(playlistNotFound(playlistId));
      default:
        return assertNever(pinned.value, 'PinOutcome');
    }
  }

  async unpin(actor: UserContext, playlistId: string): Promise<Result<void, Refused>> {
    const playlist = await this.decided(actor, playlistId, decidePlaylistPin);
    if (isErr(playlist)) return playlist;
    const unpinned = await this.deps.library.unpin(playlistId);
    if (isErr(unpinned)) return unpinned;
    return unpinned.value ? ok() : err(playlistNotFound(playlistId));
  }

  async follow(actor: UserContext, playlistId: string): Promise<Result<void, Refused>> {
    const playlist = await this.decided(actor, playlistId, decidePlaylistFollow);
    if (isErr(playlist)) return playlist;
    const followed = await this.deps.library.follow(actor.id, playlistId);
    if (isErr(followed)) return followed;
    switch (followed.value) {
      case 'followed':
        await this.deps.recorder.record([{ measure: 'follows', playlistId }]);
        return ok();
      case 'present':
        return ok();
      case 'playlist-missing':
        return err(playlistNotFound(playlistId));
      default:
        return assertNever(followed.value, 'FollowOutcome');
    }
  }

  /** Needs no read, so a follower drops a list that went private. */
  async unfollow(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<void, DatabaseUnavailable>> {
    return map(await this.deps.library.unfollow(actor.id, playlistId), () => undefined);
  }

  async listFollowed(
    actor: UserContext,
    query: { cursor?: string | undefined; limit?: number | undefined }
  ): Promise<
    Result<
      { items: FollowedPlaylistView[]; nextCursor: string | null },
      InvalidCursor | DatabaseUnavailable
    >
  > {
    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;
    const rows = await this.deps.library.listFollowed(actor, {
      cursor: cursor.value && { followedAt: cursor.value.createdAt, playlistId: cursor.value.id },
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: (row) =>
          createdAtCursorPayload({ createdAt: row.followedAt, id: row.playlistId }),
        toItem: (row) => this.toFollowedView(row),
      })
    );
  }

  async fork(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<PlaylistView, Refused | PlaylistNotFound>> {
    const source = await this.decided(actor, playlistId, decidePlaylistFork);
    if (isErr(source)) return source;
    const forked = await this.deps.library.fork(playlistId, {
      id: this.deps.newId(),
      ownerId: actor.id,
      title: source.value.title,
    });
    if (isErr(forked)) return forked;
    if (forked.value === null) return err(playlistNotFound(playlistId));
    await this.deps.recorder.record([{ measure: 'forks', playlistId }]);
    return await this.deps.views.get(actor, forked.value.id);
  }

  /** What the rules compute for the caller now, as a playlist of theirs that no longer changes. */
  async freeze(
    actor: UserContext,
    playlistId: string
  ): Promise<Result<PlaylistView, Refused | PlaylistNotSmart | PlaylistNotFound>> {
    const source = await this.decided(actor, playlistId, decidePlaylistFreeze);
    if (isErr(source)) return source;
    const { rules, title, description } = source.value;
    if (rules === null) return err(playlistNotFound(playlistId));
    const computed = await this.deps.smart.page({ id: playlistId, rules }, actor, {
      cursor: null,
      limit: rules.limit,
    });
    if (isErr(computed)) return computed;
    const videoIds = computed.value.slice(0, rules.limit).map(({ item }) => item.videoId);
    const frozen = await this.deps.library.freeze(
      { id: this.deps.newId(), ownerId: actor.id, title, description },
      videoIds
    );
    if (isErr(frozen)) return frozen;
    return await this.deps.views.get(actor, frozen.value.id);
  }

  private async decided<F>(
    actor: UserContext,
    playlistId: string,
    decide: Decide<F>
  ): Promise<Result<SeatedPlaylist, F | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    return decide({ actor, playlist: playlist.value, playlistId });
  }

  private toFollowedView({
    playlistId,
    followedAt,
    playlist,
  }: FollowedPlaylist): FollowedPlaylistView {
    if (playlist === null)
      return { playlistId, followedAt: followedAt.toISOString(), playlist: null };
    const { customThumbnailKey, posterKey, updatedAt, ...card } = playlist;
    const cover = customThumbnailKey ?? posterKey;
    return {
      playlistId,
      followedAt: followedAt.toISOString(),
      playlist: {
        ...card,
        thumbnailUrl: cover === null ? null : cdnUrl(this.deps.cdn, cover),
        updatedAt: updatedAt.toISOString(),
      },
    };
  }
}
