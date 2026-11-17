import { createCompoundContext } from '@kit/ui';

export const [SelectedVideoContext, useSelectedVideo] = createCompoundContext<{
  videoId: string | undefined;
  open: (videoId: string) => void;
}>('SelectedVideo');
