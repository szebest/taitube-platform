export interface UploadResource {
  readonly id?: string;
  readonly ownerId?: string;
  readonly userId?: string;
  readonly videoId?: string;
}

export type UploadAction = 'upload:create' | 'upload:access';
