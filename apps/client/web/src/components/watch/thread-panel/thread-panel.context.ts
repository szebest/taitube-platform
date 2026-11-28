import { createCompoundContext } from '@kit/ui';

export const [ThreadPanelContext, useThreadPanel] = createCompoundContext<{
  seek: (seconds: number) => void;
}>('ThreadPanel');
