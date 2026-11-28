import type { InvalidCursor, Page, Paginator } from '@kit/pagination';
import { type Result, assertNever, err, isErr, map, ok } from '@kit/result';
import type { PlaylistActivityView } from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  PlaylistActivityRepositoryPort,
  PlaylistRepositoryPort,
} from '@vp/core/repositories';
import type { ChannelCard, PlaylistActivity } from '@vp/domain';
import {
  type ManagePlaylistFailure,
  type RestorePlaylistItemFailure,
  decidePlaylistAction,
  decidePlaylistRestore,
  playlistActivityNotRestorable,
  playlistNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';
import { primaryCards } from './playlist-cards';

export interface PlaylistActivityServiceDeps {
  playlists: PlaylistRepositoryPort;
  activity: PlaylistActivityRepositoryPort;
  channels: Pick<ChannelRepositoryPort, 'findPrimaryByUserIds'>;
  paginator: Paginator;
}

/** The log a playlist's writes keep, for the people on it, and the owner's way back from a removal. */
export class PlaylistActivityService {
  constructor(private readonly deps: PlaylistActivityServiceDeps) {}

  async list(
    actor: UserContext,
    playlistId: string,
    query: { cursor?: string | undefined; limit?: number | undefined }
  ): Promise<
    Result<Page<PlaylistActivityView>, ManagePlaylistFailure | InvalidCursor | DatabaseUnavailable>
  > {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const permitted = decidePlaylistAction(
      { actor, playlist: playlist.value, playlistId },
      'readActivity'
    );
    if (isErr(permitted)) return permitted;

    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.activity.list(playlistId, { cursor: cursor.value, limit });
    if (isErr(rows)) return rows;
    const actors = rows.value.flatMap((row) => (row.actorUserId ? [row.actorUserId] : []));
    const cards = await primaryCards(this.deps.channels, actors);
    return map(cards, (byUser) =>
      paginator.paginate(rows.value, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (row) => toActivityView(row, byUser.get(row.actorUserId ?? '') ?? null),
      })
    );
  }

  async restore(
    actor: UserContext,
    playlistId: string,
    activityId: string
  ): Promise<Result<void, RestorePlaylistItemFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const activity = await this.deps.activity.find(activityId);
    if (isErr(activity)) return activity;

    const decided = decidePlaylistRestore({
      actor,
      playlist: playlist.value,
      playlistId,
      activityId,
      activity: activity.value,
    });
    if (isErr(decided)) return decided;
    const restored = await this.deps.playlists.restoreItem(playlistId, decided.value, actor.id);
    if (isErr(restored)) return restored;
    switch (restored.value) {
      case 'restored':
        return ok();
      case 'present':
      case 'video-missing':
        return err(playlistActivityNotRestorable(activityId));
      case 'playlist-missing':
        return err(playlistNotFound(playlistId));
      default:
        return assertNever(restored.value, 'RestoreItemOutcome');
    }
  }
}

function toActivityView(row: PlaylistActivity, actor: ChannelCard | null): PlaylistActivityView {
  return { ...row, actor, createdAt: row.createdAt.toISOString() };
}
