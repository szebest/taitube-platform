import {
  VideoCardExpanded,
  VideoCardMenu,
} from './components/video-card-actions/video-card-actions';
import { VideoCardThumb } from './components/video-card-thumb/video-card-thumb';
import {
  VideoCardByline,
  VideoCardMeta,
  VideoCardReason,
  VideoCardRoot,
  VideoCardSnippet,
  VideoCardTitle,
} from './video-card';

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
export type { VideoCardSprite } from './components/video-card-frames/video-card-frames';
export type { VideoCardActionsProps } from './components/video-card-actions/video-card-actions';
export { VideoCardSkeleton } from './components/video-card-skeleton/video-card-skeleton';
