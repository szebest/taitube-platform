import type { PlaybackEvent, Video } from '@vp/api-contracts';

/** What the playback beacon says the page was let through by and which test variant it showed. */
export type PlaybackAttribution = Pick<PlaybackEvent, 'shareLinkId' | 'experiment'>;

export function playbackAttribution({
  shareLinkId,
  experiment,
}: Pick<Video, 'shareLinkId' | 'experiment'>): PlaybackAttribution {
  return {
    shareLinkId,
    experiment: experiment && { experimentId: experiment.id, variantId: experiment.variantId },
  };
}
