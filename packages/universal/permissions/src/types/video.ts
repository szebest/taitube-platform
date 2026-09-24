type VideoVisibility = 'public' | 'unlisted' | 'private';

export interface VideoResource {
  readonly id?: string;
  readonly ownerId?: string;
  readonly userId?: string;
  readonly visibility?: VideoVisibility;
  readonly status?: string;
}
