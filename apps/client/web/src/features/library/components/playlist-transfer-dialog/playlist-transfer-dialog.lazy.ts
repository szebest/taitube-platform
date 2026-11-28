import { lazyComponent } from '@kit/ui';

export const LazyPlaylistTransferDialog = lazyComponent(
  () => import('./playlist-transfer-dialog'),
  { name: 'PlaylistTransferDialog', pick: (module) => module.PlaylistTransferDialog }
);
