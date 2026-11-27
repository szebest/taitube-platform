import { lazyComponent } from '@kit/ui';

export const LazyPlaylistSectionDialog = lazyComponent(() => import('./playlist-section-dialog'), {
  name: 'PlaylistSectionDialog',
  pick: (module) => module.PlaylistSectionDialog,
});
