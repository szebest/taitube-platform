import { createCompoundContext } from '@vp/ui';

export const [ModerationQueueContext, useModerationQueue] = createCompoundContext<{
  active: string | undefined;
  selected: ReadonlySet<string>;
  onActiveChange: (id: string) => void;
}>('ModerationQueue');
