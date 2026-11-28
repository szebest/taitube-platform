import { lazyComponent } from '@kit/ui';

export const LazyPlaylistImportDialog = lazyComponent(() => import('./playlist-import-dialog'), {
  name: 'PlaylistImportDialog',
  pick: (module) => module.PlaylistImportDialog,
});
