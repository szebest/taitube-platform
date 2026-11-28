import { type Result, andThen, err, isErr, map, ok } from '@kit/result';
import type { PlaylistItemResultView } from '@vp/api-contracts';
import type {
  AppendItemOutcome,
  MergeSource,
  PlaylistRepositoryPort,
  TransferOutcome,
} from '@vp/core/repositories';
import type { SeatedPlaylist, StoredPlaylistItem } from '@vp/domain';
import {
  type CreatePlaylistFailure,
  type DeletePlaylistFailure,
  type ManagePlaylistFailure,
  type PlaylistTransferMode,
  type TransferItemFailure,
  decidePlaylistAction,
  decidePlaylistCreate,
  decidePlaylistDelete,
  decidePlaylistRead,
  decidePlaylistTransfer,
  decidePlaylistTransferItem,
  playlistIsSmart,
  playlistNotFound,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type InvalidField, invalidField } from '@vp/validation';

export interface PlaylistTransferServiceDeps {
  playlists: PlaylistRepositoryPort;
  newId: () => string;
}

interface MergeRequest {
  sourceIds: readonly string[];
  into?: string | undefined;
  newTitle?: string | undefined;
  deleteSources: boolean;
}

type Landed = AppendItemOutcome | 'source-missing';
type Refusal = NonNullable<PlaylistItemResultView['code']>;
type Batch = { playlistId: string; results: PlaylistItemResultView[] };
type MergeFailure =
  | DeletePlaylistFailure
  | CreatePlaylistFailure
  | InvalidField
  | DatabaseUnavailable;

/** Only an item gone from the source says so; any other refusal is the caller's lack of a right. */
function refusalOf({ code }: TransferItemFailure): Refusal {
  return code === ErrorCodes.PLAYLIST_ITEM_NOT_FOUND ? code : ErrorCodes.FORBIDDEN;
}

const LANDED: Readonly<Record<Landed, Omit<PlaylistItemResultView, 'itemId'>>> = {
  added: { ok: true, duplicate: false },
  present: { ok: true, duplicate: true },
  'video-missing': { ok: false, duplicate: false, code: ErrorCodes.VIDEO_NOT_FOUND },
  'source-missing': { ok: false, duplicate: false, code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND },
};

interface Decided {
  itemIds: readonly string[];
  refused: Map<string, Refusal>;
  moving: StoredPlaylistItem[];
}

function decideItems(
  actor: UserContext,
  places: { source: SeatedPlaylist; target: SeatedPlaylist },
  itemIds: readonly string[],
  held: readonly StoredPlaylistItem[],
  mode: PlaylistTransferMode
): Decided {
  const byId = new Map(held.map((item) => [item.id, item]));
  const refused = new Map<string, Refusal>();
  const moving: StoredPlaylistItem[] = [];
  for (const itemId of itemIds) {
    const item = byId.get(itemId) ?? null;
    const one = decidePlaylistTransferItem({ actor, ...places, itemId, item, mode });
    if (isErr(one)) refused.set(itemId, refusalOf(one.error));
    else moving.push(one.value);
  }
  return { itemIds, refused, moving };
}

function resultsOf(
  { itemIds, refused }: Decided,
  landed: TransferOutcome | undefined
): PlaylistItemResultView[] {
  return itemIds.map((itemId) => {
    const code = refused.get(itemId);
    if (code) return { itemId, ok: false, duplicate: false, code };
    return { itemId, ...LANDED[landed?.get(itemId) ?? 'source-missing'] };
  });
}

/**
 * Items between playlists: each item is decided on its own, so one refusal never fails the batch,
 * and the target skips a video it holds already.
 */
export class PlaylistTransferService {
  constructor(private readonly deps: PlaylistTransferServiceDeps) {}

  async transfer(
    actor: UserContext,
    sourceId: string,
    request: { itemIds: readonly string[]; to: string; mode: PlaylistTransferMode }
  ): Promise<Result<Batch, ManagePlaylistFailure | InvalidField | DatabaseUnavailable>> {
    const { itemIds, to, mode } = request;
    if (to === sourceId) return err(invalidField('to', 'Items move to another playlist', {}));
    const source = await this.deps.playlists.findSeated(sourceId, actor.id);
    if (isErr(source)) return source;
    const target = await this.deps.playlists.findSeated(to, actor.id);
    if (isErr(target)) return target;
    const places = decidePlaylistTransfer({
      actor,
      source: source.value,
      sourceId,
      target: target.value,
      targetId: to,
      mode,
    });
    if (isErr(places)) return places;

    const items = await this.deps.playlists.findItems(sourceId, itemIds);
    if (isErr(items)) return items;
    const decided = decideItems(actor, places.value, itemIds, items.value, mode);
    const landed = await this.deps.playlists.transfer(sourceId, to, decided.moving, mode, actor.id);
    if (isErr(landed)) return landed;
    if (landed.value === null) return err(playlistNotFound(to));
    return ok({ playlistId: to, results: resultsOf(decided, landed.value) });
  }

  async duplicate(
    actor: UserContext,
    sourceId: string,
    request: { title?: string | undefined }
  ): Promise<Result<Batch, CreatePlaylistFailure | ManagePlaylistFailure | DatabaseUnavailable>> {
    const source = await this.deps.playlists.findSeated(sourceId, actor.id);
    if (isErr(source)) return source;
    const readable = decidePlaylistRead({ actor, playlist: source.value, playlistId: sourceId });
    if (isErr(readable)) return readable;
    const { title, description } = readable.value;

    const created = await this.create(actor, request.title ?? title, description);
    if (isErr(created)) return created;
    return await this.copyAll(actor, [readable.value], created.value, false);
  }

  /** A source is deleted only when every one of its items landed, in the transaction of the copy. */
  async merge(actor: UserContext, request: MergeRequest): Promise<Result<Batch, MergeFailure>> {
    const sources: SeatedPlaylist[] = [];
    for (const sourceId of request.sourceIds) {
      const source = await this.deps.playlists.findSeated(sourceId, actor.id);
      if (isErr(source)) return source;
      const input = { actor, playlist: source.value, playlistId: sourceId };
      const decided = request.deleteSources
        ? decidePlaylistDelete(input)
        : decidePlaylistRead(input);
      if (isErr(decided)) return decided;
      if (decided.value.rules !== null) return err(playlistIsSmart(sourceId));
      sources.push(decided.value);
    }

    const target = await this.mergeTarget(actor, request);
    if (isErr(target)) return target;
    if (sources.some((source) => source.id === target.value.id)) {
      return err(invalidField('into', 'A playlist cannot be merged into itself', {}));
    }
    return await this.copyAll(actor, sources, target.value, request.deleteSources);
  }

  private async mergeTarget(
    actor: UserContext,
    { into, newTitle }: MergeRequest
  ): Promise<Result<SeatedPlaylist, MergeFailure>> {
    if (into === undefined) return await this.create(actor, newTitle ?? '', '');
    const target = await this.deps.playlists.findSeated(into, actor.id);
    return andThen(target, (playlist) =>
      decidePlaylistAction({ actor, playlist, playlistId: into }, 'addItem')
    );
  }

  private async create(
    actor: UserContext,
    title: string,
    description: string
  ): Promise<Result<SeatedPlaylist, CreatePlaylistFailure | DatabaseUnavailable>> {
    const decided = decidePlaylistCreate({ actor, title, description, visibility: 'private' });
    if (isErr(decided)) return decided;
    const created = await this.deps.playlists.create({
      id: this.deps.newId(),
      ownerId: actor.id,
      ...decided.value,
    });
    return map(created, (playlist) => ({
      ...playlist,
      collaboratorId: null,
      collaboratorRole: null,
    }));
  }

  private async copyAll(
    actor: UserContext,
    sources: readonly SeatedPlaylist[],
    target: SeatedPlaylist,
    deleteSources: boolean
  ): Promise<Result<Batch, ManagePlaylistFailure | DatabaseUnavailable>> {
    const plans: (Decided & MergeSource)[] = [];
    for (const source of sources) {
      const items = await this.deps.playlists.findItems(source.id);
      if (isErr(items)) return items;
      const itemIds = items.value.map((item) => item.id);
      const decided = decideItems(actor, { source, target }, itemIds, items.value, 'copy');
      plans.push({
        ...decided,
        sourceId: source.id,
        items: decided.moving,
        deleteIfLanded: deleteSources && decided.refused.size === 0,
      });
    }
    const merged = await this.deps.playlists.merge(target.id, plans, actor.id);
    if (isErr(merged)) return merged;
    const landed = merged.value;
    if (landed === null) return err(playlistNotFound(target.id));
    return ok({
      playlistId: target.id,
      results: plans.flatMap((plan) => resultsOf(plan, landed.get(plan.sourceId))),
    });
  }
}
