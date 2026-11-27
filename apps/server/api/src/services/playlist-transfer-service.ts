import { type Result, andThen, err, isErr, map, ok } from '@kit/result';
import type { PlaylistItemResultView } from '@vp/api-contracts';
import type {
  AppendItemOutcome,
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
type Landing = Result<Batch, ManagePlaylistFailure | DatabaseUnavailable>;
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

function resultsOf(
  itemIds: readonly string[],
  refused: ReadonlyMap<string, Refusal>,
  landed: NonNullable<TransferOutcome>
): PlaylistItemResultView[] {
  return itemIds.map((itemId) => {
    const code = refused.get(itemId);
    if (code) return { itemId, ok: false, duplicate: false, code };
    return { itemId, ...LANDED[landed.get(itemId) ?? 'source-missing'] };
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
    const decided = decidePlaylistTransfer({
      actor,
      source: source.value,
      sourceId,
      target: target.value,
      targetId: to,
      mode,
    });
    if (isErr(decided)) return decided;

    const items = await this.deps.playlists.findItems(sourceId, itemIds);
    if (isErr(items)) return items;
    const byId = new Map(items.value.map((item) => [item.id, item]));
    const refused = new Map<string, Refusal>();
    const moving: StoredPlaylistItem[] = [];
    for (const itemId of itemIds) {
      const item = byId.get(itemId) ?? null;
      const one = decidePlaylistTransferItem({
        actor,
        source: decided.value.source,
        itemId,
        item,
        mode,
      });
      if (isErr(one)) refused.set(itemId, refusalOf(one.error));
      else moving.push(one.value);
    }
    return await this.land(sourceId, to, moving, mode, actor, (landed) =>
      resultsOf(itemIds, refused, landed)
    );
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
    return await this.copyAll(actor, [readable.value], created.value);
  }

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
      sources.push(decided.value);
    }

    const target = await this.mergeTarget(actor, request);
    if (isErr(target)) return target;
    if (sources.some((source) => source.id === target.value)) {
      return err(invalidField('into', 'A playlist cannot be merged into itself', {}));
    }
    const merged = await this.copyAll(actor, sources, target.value);
    if (isErr(merged) || !request.deleteSources) return merged;
    for (const source of sources) {
      const removed = await this.deps.playlists.remove(source.id);
      if (isErr(removed)) return removed;
    }
    return merged;
  }

  private async mergeTarget(
    actor: UserContext,
    { into, newTitle }: MergeRequest
  ): Promise<Result<string, MergeFailure>> {
    if (into === undefined) return await this.create(actor, newTitle ?? '', '');
    const target = await this.deps.playlists.findSeated(into, actor.id);
    return andThen(target, (playlist) =>
      map(decidePlaylistAction({ actor, playlist, playlistId: into }, 'addItem'), ({ id }) => id)
    );
  }

  private async create(
    actor: UserContext,
    title: string,
    description: string
  ): Promise<Result<string, CreatePlaylistFailure | DatabaseUnavailable>> {
    const decided = decidePlaylistCreate({ actor, title, description, visibility: 'private' });
    if (isErr(decided)) return decided;
    const created = await this.deps.playlists.create({
      id: this.deps.newId(),
      ownerId: actor.id,
      ...decided.value,
    });
    return map(created, ({ id }) => id);
  }

  private async copyAll(
    actor: UserContext,
    sources: readonly SeatedPlaylist[],
    targetId: string
  ): Promise<Landing> {
    const results: PlaylistItemResultView[] = [];
    for (const source of sources) {
      const items = await this.deps.playlists.findItems(source.id);
      if (isErr(items)) return items;
      const landed = await this.land(source.id, targetId, items.value, 'copy', actor, (outcome) =>
        resultsOf(
          items.value.map((item) => item.id),
          new Map(),
          outcome
        )
      );
      if (isErr(landed)) return landed;
      results.push(...landed.value.results);
    }
    return ok({ playlistId: targetId, results });
  }

  private async land(
    sourceId: string,
    targetId: string,
    items: readonly StoredPlaylistItem[],
    mode: PlaylistTransferMode,
    actor: UserContext,
    report: (landed: NonNullable<TransferOutcome>) => PlaylistItemResultView[]
  ): Promise<Landing> {
    const landed = await this.deps.playlists.transfer(sourceId, targetId, items, mode, actor.id);
    if (isErr(landed)) return landed;
    if (landed.value === null) return err(playlistNotFound(targetId));
    return ok({ playlistId: targetId, results: report(landed.value) });
  }
}
