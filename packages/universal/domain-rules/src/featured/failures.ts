import type { VideoVisibility } from '@vp/domain';
import { type InvalidField, invalidField } from '@vp/validation';

export type FeaturedVideoNotPublic = InvalidField<{
  readonly videoId: string;
  readonly visibility: VideoVisibility;
}>;

export function featuredVideoNotPublic(
  videoId: string,
  visibility: VideoVisibility
): FeaturedVideoNotPublic {
  return invalidField('videoIds', 'Only a public video can be pinned', { videoId, visibility });
}

