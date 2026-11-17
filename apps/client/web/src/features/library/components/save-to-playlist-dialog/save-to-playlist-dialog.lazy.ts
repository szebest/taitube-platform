import { lazyComponent } from '@kit/ui';

export const LazySaveToPlaylistDialog = lazyComponent(() => import('./save-to-playlist-dialog'), {
  name: 'SaveToPlaylistDialog',
  pick: (module) => module.SaveToPlaylistDialog,
});
