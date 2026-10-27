import {
  NowPlayingBarExpand,
  NowPlayingBarInfo,
  NowPlayingBarMedia,
  NowPlayingBarNext,
  NowPlayingBarPlayPause,
  NowPlayingBarPrevious,
  NowPlayingBarQueue,
  NowPlayingBarRoot,
  NowPlayingBarSubtitle,
  NowPlayingBarTime,
  NowPlayingBarTitle,
  NowPlayingBarTransport,
} from './now-playing-bar';
import { NowPlayingBarProgress } from './now-playing-bar-progress';

export const NowPlayingBar = {
  Root: NowPlayingBarRoot,
  Media: NowPlayingBarMedia,
  Info: NowPlayingBarInfo,
  Title: NowPlayingBarTitle,
  Subtitle: NowPlayingBarSubtitle,
  Time: NowPlayingBarTime,
  Transport: NowPlayingBarTransport,
  Previous: NowPlayingBarPrevious,
  PlayPause: NowPlayingBarPlayPause,
  Next: NowPlayingBarNext,
  Progress: NowPlayingBarProgress,
  Queue: NowPlayingBarQueue,
  Expand: NowPlayingBarExpand,
};

export { NowPlayingBarSkeleton } from './now-playing-bar';

export { useNowPlayingBar } from './now-playing-bar.context';
export { nowPlayingBarStyles } from './now-playing-bar.variants';
