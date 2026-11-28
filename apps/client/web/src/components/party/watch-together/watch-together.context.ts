import { createCompoundContext } from '@kit/ui';
import type { PartyHost } from './hooks/use-quick-watch-party';
import type { WatchTogetherSource } from './types';

export const [WatchTogetherContext, useWatchTogether] = createCompoundContext<{
  source: WatchTogetherSource;
  /** Whether a video's room starts at the moment `source` names, rather than at its start. */
  withStart: boolean;
  setWithStart: (next: boolean) => void;
  hostAs: PartyHost;
  setHostAs: (next: PartyHost) => void;
  /** Where the dialog portals: the player's fullscreen element, so it shows there. */
  container: HTMLElement | null | undefined;
}>('WatchTogether');
