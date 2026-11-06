import { lazyComponent } from '@vp/ui';

export const LazySaveToPlaylistDialog = lazyComponent(
  () =>
    import('./save-to-playlist-dialog').then((module) => ({
      default: module.SaveToPlaylistDialog,
    })),
  { name: 'SaveToPlaylistDialog' }
);
