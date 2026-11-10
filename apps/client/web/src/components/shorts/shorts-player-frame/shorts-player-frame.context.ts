import { createCompoundContext } from '@vp/ui';
import type { ShortsActionsLayout, ShortsFrameState, ShortsPlayback } from './types';

export const [ShortsPlayerFrameContext, useShortsPlayerFrame] = createCompoundContext<{
  state: ShortsFrameState;
  layout: ShortsActionsLayout;
  paused: boolean;
  playback: ShortsPlayback | undefined;
}>('ShortsPlayerFrame');
