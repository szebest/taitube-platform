import { useAccount } from '@vp/queries';
import { type PropsWithChildren, useReducer, useState } from 'react';
import { PlayerChannelProvider } from '#app/components/player/taitube-player';
import { EMPTY_SESSION, playbackReducer } from '#app/lib/playback-session/playback-session';
import { PlaybackSessionContext } from '#app/lib/playback-session/playback-session.context';
import { PlaybackHost } from '../playback-host/playback-host';

/** Holds the queue and the one player above the routes, so leaving the watch page does not stop the video; another account starts with none. */
export function PlaybackSessionProvider({ children }: PropsWithChildren) {
  const account = useAccount();

  return <Session key={account?.id}>{children}</Session>;
}

function Session({ children }: PropsWithChildren) {
  const [session, dispatch] = useReducer(playbackReducer, EMPTY_SESSION);
  const [slots, setSlots] = useState<readonly HTMLElement[]>([]);

  const registerSlot = (slot: HTMLElement) => {
    setSlots((held) => [...held, slot]);
    return () => setSlots((held) => held.filter((other) => other !== slot));
  };

  return (
    <PlayerChannelProvider>
      <PlaybackSessionContext value={{ session, dispatch, slots, registerSlot }}>
        {children}
        <PlaybackHost />
      </PlaybackSessionContext>
    </PlayerChannelProvider>
  );
}
