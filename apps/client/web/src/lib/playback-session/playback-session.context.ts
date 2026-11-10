import { createContext, type Dispatch } from 'react';
import type { PlaybackAction, PlaybackSession } from './playback-session';

export interface PlaybackSessionValue {
  session: PlaybackSession;
  dispatch: Dispatch<PlaybackAction>;
  /** The boxes a page or the mini player holds for the one player, the latest registered being the one it sits over. */
  slots: readonly HTMLElement[];
  /** A box offers itself to the player; the returned function takes it back. */
  registerSlot: (slot: HTMLElement) => () => void;
}

export const PlaybackSessionContext = createContext<PlaybackSessionValue | undefined>(undefined);
