import { createCompoundContext } from '@kit/ui';
import type { WatchTogetherSource } from './types';

export const [WatchTogetherContext, useWatchTogether] = createCompoundContext<{
  source: WatchTogetherSource;
  /** Whether a video's room starts at the moment `source` names, rather than at its start. */
  withStart: boolean;
  setWithStart: (next: boolean) => void;
  /** Where the dialog portals: the player's fullscreen element, so it shows there. */
  container: HTMLElement | null | undefined;
}>('WatchTogether');
