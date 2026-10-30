import {
  VideoCardByline,
  VideoCardMeta,
  VideoCardReason,
  VideoCardRoot,
  VideoCardSnippet,
  VideoCardTitle,
} from './video-card';
import { VideoCardExpanded, VideoCardMenu } from './video-card-actions';
import { VideoCardThumb } from './video-card-thumb';

export const VideoCard = {
  Root: VideoCardRoot,
  Thumb: VideoCardThumb,
  Byline: VideoCardByline,
  Title: VideoCardTitle,
  Meta: VideoCardMeta,
  Snippet: VideoCardSnippet,
  Reason: VideoCardReason,
  Menu: VideoCardMenu,
  Expanded: VideoCardExpanded,
};
export type { VideoCardVariant } from './types';
export { useVideoCard } from './video-card.context';
export { videoCardStyles } from './video-card.variants';
export type { VideoCardActionsProps } from './video-card-actions';
export { VideoCardSkeleton } from './video-card-skeleton';
