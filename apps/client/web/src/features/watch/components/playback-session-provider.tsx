import { type PropsWithChildren, useEffect, useReducer, useState } from 'react';

import { useAccount } from '@vp/queries';

import { PlayerChannelProvider } from '#app/features/player';

import { EMPTY_SESSION, playbackReducer } from '../playback-session';
import { PlaybackSessionContext } from '../playback-session.context';
import { PersistentPlayer } from './persistent-player';

function createHost() {
  if (typeof document === 'undefined') {
    return {};
  }

  const host = document.createElement('div');
  host.style.display = 'contents';
  const park = document.createElement('div');
  park.setAttribute('aria-hidden', 'true');
  park.style.cssText = 'position:fixed;inline-size:0;block-size:0;overflow:hidden';
  park.append(host);
  return { host, park };
}

/** Holds the queue and the one player above the routes, so leaving the watch page does not stop the video; another account starts with none. */
export function PlaybackSessionProvider({ children }: PropsWithChildren) {
  const account = useAccount();

  return <Session key={account?.id}>{children}</Session>;
}

function Session({ children }: PropsWithChildren) {
  const [session, dispatch] = useReducer(playbackReducer, EMPTY_SESSION);
  const [{ host, park }] = useState(createHost);

  useEffect(() => {
    if (!park) {
      return;
    }

    document.body.append(park);
    return () => park.remove();
  }, [park]);

  return (
    <PlayerChannelProvider>
      <PlaybackSessionContext value={{ session, dispatch, host, park }}>
        {children}
        <PersistentPlayer />
      </PlaybackSessionContext>
    </PlayerChannelProvider>
  );
}
