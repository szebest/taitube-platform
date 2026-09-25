import type { PlaylistVisibility } from '@vp/domain';
import { type UserContext, canCreatePlaylist } from '@vp/permissions';
import { type Result, andThen, map } from '@vp/result';
import {
  type InvalidPlaylistDetails,
  validatePlaylistDescription,
  validatePlaylistTitle,
} from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';

export interface CreatePlaylistInput {
  readonly actor: UserContext | null;
  readonly title: string;
  readonly description?: string;
  readonly visibility?: PlaylistVisibility;
}

export interface PlaylistToCreate {
  readonly title: string;
  readonly description: string;
  readonly visibility: PlaylistVisibility;
}

export type CreatePlaylistFailure = AuthorizationFailure | InvalidPlaylistDetails;

export function decidePlaylistCreate(
  input: CreatePlaylistInput
): Result<PlaylistToCreate, CreatePlaylistFailure> {
  return andThen(
    authorize(input.actor, canCreatePlaylist({ user: input.actor }), {
      action: 'create',
      subject: 'Playlist',
    }),
    () =>
      andThen(validatePlaylistTitle(input.title), (title) =>
        map(validatePlaylistDescription(input.description ?? ''), (description) => ({
          title,
          description,
          visibility: input.visibility ?? 'private',
        }))
      )
  );
}
