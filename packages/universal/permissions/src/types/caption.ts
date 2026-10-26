import type { VideoResource } from './video';

/** A video's captions and transcript, judged by the video they belong to. */
export interface CaptionResource {
  readonly videoId: string;
  readonly ownerId: string;
  readonly visibility: NonNullable<VideoResource['visibility']>;
}
