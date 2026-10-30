import {
  VideoThumbnailBadge,
  VideoThumbnailDuration,
  VideoThumbnailImage,
  VideoThumbnailLive,
  VideoThumbnailProgress,
  VideoThumbnailRoot,
} from './video-thumbnail';

export const VideoThumbnail = {
  Root: VideoThumbnailRoot,
  Image: VideoThumbnailImage,
  Badge: VideoThumbnailBadge,
  Duration: VideoThumbnailDuration,
  Progress: VideoThumbnailProgress,
  Live: VideoThumbnailLive,
};
export type { VideoThumbnailAspect, VideoThumbnailRadius } from './types';
export type {
  VideoThumbnailDurationProps,
  VideoThumbnailImageProps,
  VideoThumbnailProgressProps,
  VideoThumbnailRootProps,
} from './video-thumbnail';
export { VideoThumbnailSkeleton, videoTransitionName } from './video-thumbnail';
export { useVideoThumbnail } from './video-thumbnail.context';
export { videoThumbnailStyles } from './video-thumbnail.variants';
