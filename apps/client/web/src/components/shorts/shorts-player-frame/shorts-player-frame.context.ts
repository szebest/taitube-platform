import { createCompoundContext } from '@vp/ui';
import type {
  ShortsActionsLayout,
  ShortsDirection,
  ShortsFrameState,
  ShortsPlayback,
} from './types';

export const [ShortsPlayerFrameContext, useShortsPlayerFrame] = createCompoundContext<{
  state: ShortsFrameState;
  layout: ShortsActionsLayout;
  paused: boolean;
  muted: boolean;
  playback: ShortsPlayback | undefined;
  entered: ShortsDirection | undefined;
}>('ShortsPlayerFrame');
