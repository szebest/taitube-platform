import { type PropsWithChildren, useReducer } from 'react';
import { EMPTY_SESSION, playbackReducer } from '#app/lib/playback-session/playback-session';
import { PlaybackSessionContext } from '#app/lib/playback-session/playback-session.context';

/** The playback session's state without the player it hosts, for a spec of what reads or changes the queue. */
export function PlaybackSessionStub({ children }: PropsWithChildren) {
  const [session, dispatch] = useReducer(playbackReducer, EMPTY_SESSION);

  return (
    <PlaybackSessionContext
      value={{ session, dispatch, slots: [], registerSlot: () => () => undefined }}
    >
      {children}
    </PlaybackSessionContext>
  );
}
