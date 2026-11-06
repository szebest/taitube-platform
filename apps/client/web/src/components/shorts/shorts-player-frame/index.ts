import {
  ShortsPlayerFrameAction,
  ShortsPlayerFrameActions,
} from './components/shorts-player-frame-actions/shorts-player-frame-actions';
import { ShortsPlayerFramePlayer } from './components/shorts-player-frame-player/shorts-player-frame-player';
import {
  ShortsPlayerFrameCaption,
  ShortsPlayerFrameError,
  ShortsPlayerFrameProgress,
  ShortsPlayerFrameRoot,
} from './shorts-player-frame';

export const ShortsPlayerFrame = {
  Root: ShortsPlayerFrameRoot,
  Player: ShortsPlayerFramePlayer,
  Error: ShortsPlayerFrameError,
  Caption: ShortsPlayerFrameCaption,
  Progress: ShortsPlayerFrameProgress,
  Actions: ShortsPlayerFrameActions,
  Action: ShortsPlayerFrameAction,
};

export { ShortsPlayerFrameSkeleton } from './shorts-player-frame';

export { useShortsPlayerFrame } from './shorts-player-frame.context';
export { shortsPlayerFrameStyles } from './shorts-player-frame.variants';
