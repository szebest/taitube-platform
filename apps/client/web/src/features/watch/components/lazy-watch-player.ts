import { lazy } from 'react';

export const LazyWatchPlayer = lazy(() =>
  import('./watch-player').then((player) => ({ default: player.WatchPlayer }))
);
