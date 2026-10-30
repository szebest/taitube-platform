import { createCompoundContext } from '@vp/ui';
import type { VideoCardSize, VideoCardState, VideoCardVariant } from './types';

export const [VideoCardContext, useVideoCard] = createCompoundContext<{
  variant: VideoCardVariant;
  state: VideoCardState;
  size: VideoCardSize;
  videoId: string | undefined;
  expanded: boolean;
}>('VideoCard');
