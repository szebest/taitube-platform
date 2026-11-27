import { createCompoundContext } from '@kit/ui';

export const [PlaylistSectionRowContext, usePlaylistSectionRow] = createCompoundContext<{
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
}>('PlaylistSectionRow');
