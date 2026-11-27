import { type Result, andThen, err, map, ok } from '@kit/result';
import type { PlaylistPatch, SeatedPlaylist } from '@vp/domain';
import {
  type ShareGrant,
  type UserContext,
  canAddPlaylistItem,
  canDeletePlaylist,
  canManagePlaylistCollaborators,
  canManagePlaylistItems,
  canReadPlaylist,
  canReadPlaylistActivity,
  canRemovePlaylistItem,
  canRestorePlaylistItem,
  canUpdatePlaylist,
} from '@vp/permissions';
import { type InvalidPlaylistDetails, validatePlaylistDetails } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type PlaylistIsSmart,
  type PlaylistNotFound,
  type SystemPlaylistImmutable,
  playlistIsSmart,
  playlistNotFound,
  systemPlaylistImmutable,
} from './failures';
import {
  type PlaylistSettingsContext,
  type PlaylistSettingsFailure,
  decidePlaylistSettings,
} from './playlist-settings.rule';

export interface ManagePlaylistInput {
  readonly actor: UserContext | null;
  readonly playlist: SeatedPlaylist | null;
  readonly playlistId: string;
  /** A live share link of this playlist, as `decideShareLinkUse` proved it; it grants read alone. */
  readonly share?: ShareGrant | null;
}

export interface UpdatePlaylistInput extends ManagePlaylistInput {
  readonly patch: PlaylistPatch;
  readonly context: PlaylistSettingsContext;
}

export type ManagePlaylistFailure = PlaylistNotFound | AuthorizationFailure | PlaylistIsSmart;
export type DeletePlaylistFailure = ManagePlaylistFailure | SystemPlaylistImmutable;
export type UpdatePlaylistFailure =
  | DeletePlaylistFailure
  | InvalidPlaylistDetails
  | PlaylistSettingsFailure;

type PlaylistCheck = (check: {
  user: UserContext | null;
  playlist: SeatedPlaylist & { addedBy?: string | null };
}) => boolean;

const ACTIONS = {
  delete: canDeletePlaylist,
  addItem: canAddPlaylistItem,
  removeItem: canRemovePlaylistItem,
  manageItems: canManagePlaylistItems,
  manageCollaborators: canManagePlaylistCollaborators,
  readActivity: canReadPlaylistActivity,
  restoreItem: canRestorePlaylistItem,
} as const satisfies Record<string, PlaylistCheck>;

export type PlaylistAction = keyof typeof ACTIONS;

const ITEM_ACTIONS: ReadonlySet<PlaylistAction> = new Set([
  'addItem',
  'removeItem',
  'manageItems',
  'restoreItem',
]);

/** The item a check is about, when it is about one: its adder decides a contributor's reach. */
export interface PlaylistItemSubject {
  readonly addedBy: string | null;
}

/** A playlist the actor cannot read is absent to them, so a private id never confirms it exists. */
export function decidePlaylistRead(
  input: ManagePlaylistInput
): Result<SeatedPlaylist, PlaylistNotFound> {
  const { actor, playlist, share = null } = input;
  return playlist && canReadPlaylist({ user: actor, playlist, share })
    ? ok(playlist)
    : err(playlistNotFound(input.playlistId));
}

/**
 * One the actor can read but not act on is a 403 they can understand. A smart playlist computes its
 * items, so no item action applies to it, whoever asks.
 */
export function decidePlaylistAction(
  input: ManagePlaylistInput,
  action: PlaylistAction,
  item?: PlaylistItemSubject
): Result<SeatedPlaylist, ManagePlaylistFailure> {
  return andThen(decidePlaylistRead(input), (playlist) => {
    const subject = item ? { ...playlist, addedBy: item.addedBy } : playlist;
    return andThen(
      authorize(input.actor, ACTIONS[action]({ user: input.actor, playlist: subject }), {
        action,
        subject: 'Playlist',
      }),
      () =>
        playlist.rules !== null && ITEM_ACTIONS.has(action)
          ? err(playlistIsSmart(playlist.id))
          : ok(playlist)
    );
  });
}

/** Watch Later keeps its system rules: never renamed, deleted or shared. */
export function userEditable(
  playlist: SeatedPlaylist
): Result<SeatedPlaylist, SystemPlaylistImmutable> {
  return playlist.isSystem ? err(systemPlaylistImmutable(playlist.id)) : ok(playlist);
}

/**
 * Each field of the patch on its own: an editor may retitle, only the owner changes visibility and
 * the settings. Watch Later takes `autoRemoveWatched` and nothing else.
 */
export function decidePlaylistUpdate(
  input: UpdatePlaylistInput
): Result<PlaylistPatch, UpdatePlaylistFailure> {
  return andThen(decidePlaylistRead(input), (playlist) => decideFields(input, playlist));
}

function decideFields(
  input: UpdatePlaylistInput,
  playlist: SeatedPlaylist
): Result<PlaylistPatch, UpdatePlaylistFailure> {
  const { actor } = input;
  const fields = Object.entries(input.patch)
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field);
  const allowed =
    canUpdatePlaylist({ user: actor, playlist }) &&
    fields.every((field) => canUpdatePlaylist({ user: actor, playlist, field }));
  const { visibility, kind } = input.patch;
  const systemSafe = fields.every((field) => field === 'autoRemoveWatched');
  return andThen(authorize(actor, allowed, { action: 'update', subject: 'Playlist' }), () =>
    andThen(systemSafe ? ok(playlist) : userEditable(playlist), () =>
      andThen(decidePlaylistSettings(playlist, input.patch, input.context), (settings) =>
        map(validatePlaylistDetails(input.patch), (details) => ({
          ...details,
          ...(visibility === undefined ? {} : { visibility }),
          ...(kind === undefined ? {} : { kind }),
          ...settings,
        }))
      )
    )
  );
}

export function decidePlaylistDelete(
  input: ManagePlaylistInput
): Result<SeatedPlaylist, DeletePlaylistFailure> {
  return andThen(decidePlaylistAction(input, 'delete'), userEditable);
}
