import { useEffect, useRef } from 'react';
import type { PlaybackControl } from '#app/lib/player/taitube-player-props';
import { useCaptionsContext } from '../hooks/use-captions';
import { usePlayerCommands } from '../hooks/use-player-commands';

/** The media starts as the element's `autoPlay` and `muted` say; only a change after that is a command. */
export function PlaybackSync({ paused, muted, speed, captions }: PlaybackControl) {
  const { play, pause, setMuted, setPlaybackRate } = usePlayerCommands();
  const { state, commands } = useCaptionsContext();
  const shown = state.captionsEnabled;
  const applied = useRef({ paused, muted, speed });

  useEffect(() => {
    if (applied.current.paused === paused) {
      return;
    }

    applied.current.paused = paused;
    if (paused) {
      pause();
      return;
    }

    play();
  }, [paused, play, pause]);

  useEffect(() => {
    if (applied.current.muted === muted) {
      return;
    }

    applied.current.muted = muted;
    setMuted(muted);
  }, [muted, setMuted]);

  useEffect(() => {
    if (speed === undefined || applied.current.speed === speed) {
      return;
    }

    applied.current.speed = speed;
    setPlaybackRate(speed);
  }, [speed, setPlaybackRate]);

  useEffect(() => {
    if (captions !== undefined && captions !== shown) {
      commands.toggleCaptions();
    }
  }, [captions, shown, commands]);

  return null;
}
