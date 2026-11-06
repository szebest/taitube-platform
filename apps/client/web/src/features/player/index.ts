import { type ComponentProps, type ComponentType, lazy } from 'react';

export {
  type PlayerChannel,
  PlayerChannelProvider,
  useOnPlayerEnded,
  usePlayerFullscreen,
  usePlayerSeek,
  usePlayerTheater,
  usePlayerTime,
} from './player-channel';

import type { TaitubePlayer as Player, TaitubePlayerWithTelemetryProps } from './taitube-player';
import type { TaitubePreview as Preview } from './taitube-preview';

export type {
  PlaybackControl,
  PlaybackDefaults,
  PlaybackEnd,
  PlaybackProgress,
  PlaybackQuality,
  PlaybackRange,
  PlayerLayout,
  TaitubePlayerProps,
} from './taitube-player-props';
export type { TaitubePlayerWithTelemetryProps };

export const TaitubePlayer: ComponentType<ComponentProps<typeof Player>> = lazy(() =>
  import('./taitube-player').then((module) => ({ default: module.TaitubePlayer }))
);

export const TaitubePreview: ComponentType<ComponentProps<typeof Preview>> = lazy(() =>
  import('./taitube-preview').then((module) => ({ default: module.TaitubePreview }))
);
