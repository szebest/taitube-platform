import { type Result, andThen, err, map, ok } from '@kit/result';
import {
  DEFAULT_PLAYLIST_VISIBILITY,
  type PlaylistKind,
  type PlaylistVisibility,
  type SmartPlaylistRules,
} from '@vp/domain';
import { type UserContext, canCreatePlaylist } from '@vp/permissions';
import {
  type InvalidField,
  type InvalidPlaylistDetails,
  invalidField,
  validatePlaylistDescription,
  validatePlaylistTitle,
} from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';

export interface CreatePlaylistInput {
  readonly actor: UserContext | null;
  readonly title: string;
  readonly description?: string;
  readonly visibility?: PlaylistVisibility;
  readonly kind?: PlaylistKind;
  /** Makes it smart: it stores no items and computes them from these on read. */
  readonly rules?: SmartPlaylistRules;
}

export interface PlaylistToCreate {
  readonly title: string;
  readonly description: string;
  readonly visibility: PlaylistVisibility;
  readonly kind: PlaylistKind;
  readonly rules: SmartPlaylistRules | null;
}

export type CreatePlaylistFailure = AuthorizationFailure | InvalidPlaylistDetails | InvalidField;

/** A series is made of its owner's own videos, so it is never smart. */
export function decidePlaylistCreate(
  input: CreatePlaylistInput
): Result<PlaylistToCreate, CreatePlaylistFailure> {
  const kind = input.kind ?? 'playlist';
  const rules = input.rules ?? null;
  return andThen(
    authorize(input.actor, canCreatePlaylist({ user: input.actor }), {
      action: 'create',
      subject: 'Playlist',
    }),
    () =>
      andThen(
        rules !== null && kind === 'series'
          ? err(invalidField('rules', 'A series cannot be smart', {}))
          : ok(rules),
        () =>
          andThen(validatePlaylistTitle(input.title), (title) =>
            map(validatePlaylistDescription(input.description ?? ''), (description) => ({
              title,
              description,
              visibility: input.visibility ?? DEFAULT_PLAYLIST_VISIBILITY,
              kind,
              rules,
            }))
          )
      )
  );
}
