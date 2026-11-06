import { lazyComponent } from '@vp/ui';

export const LazyNewPlaylistDialog = lazyComponent(
  () => import('./new-playlist-dialog').then((module) => ({ default: module.NewPlaylistDialog })),
  { name: 'NewPlaylistDialog' }
);
