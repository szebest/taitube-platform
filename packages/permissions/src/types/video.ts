export type VideoVisibility = 'public' | 'unlisted' | 'private';

export interface VideoResource {
  readonly id?: string;
  readonly ownerId?: string;
  readonly userId?: string;
  readonly visibility?: VideoVisibility;
  readonly status?: string;
}

export type VideoAction =
  | 'video:read'
  | 'video:create'
  | 'video:update'
  | 'video:delete'
  | 'video:publish'
  | 'video:react';
