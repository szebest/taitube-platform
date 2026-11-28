import { lazyComponent } from '@kit/ui';

export const LazyPlaylistItemDialog = lazyComponent(() => import('./playlist-item-dialog'), {
  name: 'PlaylistItemDialog',
  pick: (module) => module.PlaylistItemDialog,
});
