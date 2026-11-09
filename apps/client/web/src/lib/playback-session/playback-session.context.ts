import { createContext, type Dispatch } from 'react';
import type { PlaybackAction, PlaybackSession } from './playback-session';

export interface PlaybackSessionValue {
  session: PlaybackSession;
  dispatch: Dispatch<PlaybackAction>;
  /** The one element the player lives in; the stage and the now playing bar each take it in turn. */
  host: HTMLElement | undefined;
  /** Holds the host, out of sight but in the document, while no slot does, so the video never stops for lack of a parent. */
  park: HTMLElement | undefined;
}

export const PlaybackSessionContext = createContext<PlaybackSessionValue | undefined>(undefined);
