import { createCompoundContext } from '@vp/ui';
import type { NowPlayingBarStatus } from './types';

export const [NowPlayingBarContext, useNowPlayingBar] = createCompoundContext<{
  playing: boolean;
  progress: number;
  status: NowPlayingBarStatus;
  onPlayPause: () => void;
  onSeek: (fraction: number) => void;
}>('NowPlayingBar');
