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
import type { PlaylistItemPatch, PlaylistItemSort, SmartPlaylistRules } from '@vp/domain';
import {
  type EditPlaylistItemFailure,
  type ManagePlaylistFailure,
  type PlaylistItemNotFound,
  type PlaylistNotFound,
  type ShareLinkExpired,
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
import type { PlaylistSharingService } from './playlist-sharing-service';
import type { SmartPlaylistReader } from './smart-playlist-reader';
import type { SpriteGeometry } from './video-views';

export interface PlaylistItemServiceDeps {
  playlists: PlaylistRepositoryPort;
  videos: Pick<VideoRepository, 'findById'>;
  smart: Pick<SmartPlaylistReader, 'page'>;
  sharing: Pick<PlaylistSharingService, 'shareOf'>;
  paginator: Paginator;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  newId: () => string;
}

interface ItemsQuery {
  sort: PlaylistItemSort;
  cursor?: string | undefined;
  limit?: number | undefined;
  shareToken?: string | null;
}

/** A smart playlist pages in its rules' order whatever the sort asked, so its cursor names that. */
const SMART_SORT = 'smart';

type Acting = ManagePlaylistFailure | DatabaseUnavailable;
type ItemPage = Page<PlaylistView['items'][number]>;

/** Names its sort and is refused under another: a duration resumes nothing in a walk by channel. */
function itemCursorPayload(sort: string, key: string | number, id: string): CursorPayload {
  return { sort, key, id };
}

function decodeItemCursor(cursor: string | undefined, sort: string, paginator: Paginator) {
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
  ): Promise<
    Result<ItemPage, PlaylistNotFound | ShareLinkExpired | InvalidCursor | DatabaseUnavailable>
  > {
    const share = await this.deps.sharing.shareOf(query.shareToken ?? null, playlistId);
    if (isErr(share)) return share;
    const playlist = await this.deps.playlists.findSeated(playlistId, viewer?.id ?? null);
    if (isErr(playlist)) return playlist;
    const readable = decidePlaylistRead({
      actor: viewer,
      playlist: playlist.value,
      playlistId,
      share: share.value?.grant ?? null,
    });
    if (isErr(readable)) return readable;
    const { rules } = readable.value;
    if (rules !== null) return await this.smartPage(viewer, playlistId, rules, query);

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
        cursorOf: ({ entry, key }: SortedPlaylistEntry) =>
          itemCursorPayload(query.sort, key, entry.id),
        toItem: ({ entry }) => toPlaylistItemView(entry, cdn, sprite),
      })
    );
  }

  private async smartPage(
    viewer: UserContext | null,
    playlistId: string,
    rules: SmartPlaylistRules,
    query: ItemsQuery
  ): Promise<Result<ItemPage, InvalidCursor | DatabaseUnavailable>> {
    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeItemCursor(query.cursor, SMART_SORT, paginator);
    if (isErr(cursor)) return cursor;
    const { key, id } = cursor.value ?? { key: 0, id: '' };
    if (typeof key !== 'number') return err(invalidCursor());

    const rows = await this.deps.smart.page({ id: playlistId, rules }, viewer, {
      cursor: cursor.value && { key, id },
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: (row) => itemCursorPayload(SMART_SORT, row.key, row.item.id),
        toItem: (row) => row.item,
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
