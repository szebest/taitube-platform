import { createCompoundContext } from '@vp/ui';
import type { VideoThumbnailAspect } from './types';

export const [VideoThumbnailContext, useVideoThumbnail] = createCompoundContext<{
  aspect: VideoThumbnailAspect;
  videoId: string | undefined;
}>('VideoThumbnail');
