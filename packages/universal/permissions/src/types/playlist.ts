type PlaylistVisibility = 'public' | 'unlisted' | 'private';

export interface PlaylistResource {
  readonly id?: string;
  readonly ownerId?: string;
  readonly visibility?: PlaylistVisibility;
}
