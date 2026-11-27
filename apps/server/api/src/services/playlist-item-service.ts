import {
  type CursorPayload,
  type InvalidCursor,
  type Page,
  type Paginator,
  invalidCursor,
} from '@kit/pagination';
import { type Result, err, isErr, map, ok } from '@kit/result';
import type { PlaylistView } from '@vp/api-contracts';
import type {
  PlaylistItemCursor,
  PlaylistRepositoryPort,
  SortedPlaylistEntry,
  VideoRepository,
} from '@vp/core/repositories';
import type { PlaylistItemPatch, PlaylistItemSort } from '@vp/domain';
import {
  type EditPlaylistItemFailure,
  type ManagePlaylistFailure,
  type PlaylistItemNotFound,
  type PlaylistNotFound,
  decidePlaylistAction,
  decidePlaylistItemEdit,
  decidePlaylistRead,
  decidePlaylistSectionAdd,
  playlistItemNotFound,
  playlistNotFound,
} from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { InvalidPlaylistDetails } from '@vp/validation';
import { decodeWith } from './cursor';
import { toPlaylistItemView } from './library-views';
import type { SpriteGeometry } from './video-views';

export interface PlaylistItemServiceDeps {
  playlists: PlaylistRepositoryPort;
  videos: Pick<VideoRepository, 'findById'>;
  paginator: Paginator;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  newId: () => string;
}

interface ItemsQuery {
  sort: PlaylistItemSort;
  cursor?: string | undefined;
  limit?: number | undefined;
}

type Acting = ManagePlaylistFailure | DatabaseUnavailable;
type ItemPage = Page<PlaylistView['items'][number]>;

/** Names its sort and is refused under another: a duration resumes nothing in a walk by channel. */
function itemCursorPayload(
  sort: PlaylistItemSort,
  { entry, key }: SortedPlaylistEntry
): CursorPayload {
  return { sort, key, id: entry.id };
}

function decodeItemCursor(
  cursor: string | undefined,
  sort: PlaylistItemSort,
  paginator: Paginator
) {
  return decodeWith(cursor, paginator, (payload): Result<PlaylistItemCursor, InvalidCursor> => {
    const key = payload['key'];
    const id = payload['id'];
    if (payload['sort'] !== sort || typeof id !== 'string') return err(invalidCursor());
    if (typeof key === 'string' || (typeof key === 'number' && Number.isFinite(key))) {
      return ok({ key, id });
    }
    return err(invalidCursor());
  });
}

/** The items of one playlist one at a time: their words, their sections and their order. */
export class PlaylistItemService {
  constructor(private readonly deps: PlaylistItemServiceDeps) {}

  async list(
    viewer: UserContext | null,
    playlistId: string,
    query: ItemsQuery
  ): Promise<Result<ItemPage, PlaylistNotFound | InvalidCursor | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, viewer?.id ?? null);
    if (isErr(playlist)) return playlist;
    const readable = decidePlaylistRead({ actor: viewer, playlist: playlist.value, playlistId });
    if (isErr(readable)) return readable;

    const { paginator, cdn, sprite } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeItemCursor(query.cursor, query.sort, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.playlists.listItems(playlistId, viewer, {
      sort: query.sort,
      cursor: cursor.value,
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: (row) => itemCursorPayload(query.sort, row),
        toItem: ({ entry }) => toPlaylistItemView(entry, cdn, sprite),
      })
    );
  }

  async edit(
    actor: UserContext,
    playlistId: string,
    itemId: string,
    patch: PlaylistItemPatch
  ): Promise<Result<void, EditPlaylistItemFailure | DatabaseUnavailable>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const items = await this.deps.playlists.findItems(playlistId, [itemId]);
    if (isErr(items)) return items;
    const item = items.value[0] ?? null;
    const video = item?.videoId ? await this.deps.videos.findById(item.videoId) : ok(null);
    if (isErr(video)) return video;

    const decided = decidePlaylistItemEdit({
      actor,
      playlist: playlist.value,
      playlistId,
      itemId,
      item,
      patch,
      durationMs: video.value?.durationMs ?? null,
    });
    if (isErr(decided)) return decided;
    const edited = await this.deps.playlists.editItem(playlistId, itemId, decided.value, actor.id);
    if (isErr(edited)) return edited;
    return edited.value ? ok() : err(playlistItemNotFound(playlistId, itemId));
  }

  async addSection(
    actor: UserContext,
    playlistId: string,
    title: string
  ): Promise<Result<{ id: string }, Acting | InvalidPlaylistDetails>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const decided = decidePlaylistSectionAdd({
      actor,
      playlist: playlist.value,
      playlistId,
      title,
    });
    if (isErr(decided)) return decided;

    const id = this.deps.newId();
    const added = await this.deps.playlists.addSection(
      playlistId,
      { id, title: decided.value.title, addedBy: actor.id },
      actor.id
    );
    if (isErr(added)) return added;
    return added.value ? ok({ id }) : err(playlistNotFound(playlistId));
  }

  async removeSection(
    actor: UserContext,
    playlistId: string,
    itemId: string
  ): Promise<Result<void, Acting | PlaylistItemNotFound>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const decided = decidePlaylistAction(
      { actor, playlist: playlist.value, playlistId },
      'manageItems'
    );
    if (isErr(decided)) return decided;
    const items = await this.deps.playlists.findItems(playlistId, [itemId]);
    if (isErr(items)) return items;
    if (items.value[0]?.kind !== 'section') return err(playlistItemNotFound(playlistId, itemId));

    const removed = await this.deps.playlists.removeItem(
      playlistId,
      { by: 'item', itemId },
      actor.id
    );
    if (isErr(removed)) return removed;
    return removed.value ? ok() : err(playlistItemNotFound(playlistId, itemId));
  }

  async sort(
    actor: UserContext,
    playlistId: string,
    sort: Exclude<PlaylistItemSort, 'manual'>
  ): Promise<Result<void, Acting>> {
    const playlist = await this.deps.playlists.findSeated(playlistId, actor.id);
    if (isErr(playlist)) return playlist;
    const decided = decidePlaylistAction(
      { actor, playlist: playlist.value, playlistId },
      'manageItems'
    );
    if (isErr(decided)) return decided;
    const sorted = await this.deps.playlists.writeSort(playlistId, sort, actor);
    if (isErr(sorted)) return sorted;
    return sorted.value ? ok() : err(playlistNotFound(playlistId));
  }
}
