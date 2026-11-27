import { lazyComponent } from '@kit/ui';

export const LazyNewPlaylistDialog = lazyComponent(() => import('./new-playlist-dialog'), {
  name: 'NewPlaylistDialog',
  pick: (module) => module.NewPlaylistDialog,
});
