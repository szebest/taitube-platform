import { lazyComponent } from '@vp/ui';

export const LazyNewPlaylistDialog = lazyComponent(() => import('./new-playlist-dialog'), {
  name: 'NewPlaylistDialog',
  pick: (module) => module.NewPlaylistDialog,
});
