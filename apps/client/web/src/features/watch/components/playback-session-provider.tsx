import { type PropsWithChildren, useReducer, useState } from 'react';

import { PlayerChannelProvider } from '#app/features/player';

import { EMPTY_SESSION, playbackReducer } from '../playback-session';
import { PlaybackSessionContext } from '../playback-session.context';
import { PersistentPlayer } from './persistent-player';

function createHost() {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const host = document.createElement('div');
  host.style.display = 'contents';
  return host;
}

/** Holds the queue and the one player above the routes, so leaving the watch page does not stop the video. */
export function PlaybackSessionProvider({ children }: PropsWithChildren) {
  const [session, dispatch] = useReducer(playbackReducer, EMPTY_SESSION);
  const [host] = useState(createHost);

  return (
    <PlayerChannelProvider>
      <PlaybackSessionContext value={{ session, dispatch, host }}>
        {children}
        <PersistentPlayer />
      </PlaybackSessionContext>
    </PlayerChannelProvider>
  );
}
