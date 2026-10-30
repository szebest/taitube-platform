import {
  ShortsPlayerFrameCaption,
  ShortsPlayerFrameError,
  ShortsPlayerFrameProgress,
  ShortsPlayerFrameRoot,
} from './shorts-player-frame';
import { ShortsPlayerFrameAction, ShortsPlayerFrameActions } from './shorts-player-frame-actions';
import { ShortsPlayerFramePlayer } from './shorts-player-frame-player';

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
