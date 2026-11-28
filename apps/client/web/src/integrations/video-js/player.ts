import { liveFeature, videoFeatures } from '@videojs/core/dom';
import { createPlayer } from '@videojs/react';

export const { Player: VideoPlayer, usePlayer } = createPlayer({
  features: [...videoFeatures, liveFeature],
  displayName: 'TaitubeVideoPlayer',
});
