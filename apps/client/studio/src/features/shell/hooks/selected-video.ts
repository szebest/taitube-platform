import { createCompoundContext } from '@vp/ui';

export const [SelectedVideoContext, useSelectedVideo] = createCompoundContext<{
  videoId: string | undefined;
  open: (videoId: string) => void;
}>('SelectedVideo');
