import type { VideoResource } from './video';

/** `visibility` is the clipped video's: only a public one takes new clips. */
export interface ClipResource {
  readonly userId?: string;
  readonly visibility?: NonNullable<VideoResource['visibility']>;
}
