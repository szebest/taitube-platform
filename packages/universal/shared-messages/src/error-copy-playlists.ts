import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { SharedArgumentFreeKey } from './catalogue';

export const PLAYLIST_ERROR_COPY = {
  [ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS]: 'errors.playlistCollaboratorExists',
  [ErrorCodes.PLAYLIST_COLLABORATOR_LIMIT]: 'errors.playlistCollaboratorLimit',
  [ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND]: 'errors.playlistCollaboratorNotFound',
  [ErrorCodes.PLAYLIST_INVITE_INVALID]: 'errors.playlistInviteInvalid',
  [ErrorCodes.PLAYLIST_ACTIVITY_NOT_FOUND]: 'errors.playlistActivityNotFound',
  [ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE]: 'errors.playlistActivityNotRestorable',
} as const satisfies Partial<Record<ErrorCode, SharedArgumentFreeKey>>;
