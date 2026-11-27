import { lazyComponent } from '@kit/ui';

export const LazyPlaylistMergeDialog = lazyComponent(() => import('./playlist-merge-dialog'), {
  name: 'PlaylistMergeDialog',
  pick: (module) => module.PlaylistMergeDialog,
});
