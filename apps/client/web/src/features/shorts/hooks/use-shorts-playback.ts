import { useState } from 'react';
import { useReducedMotion } from '#app/hooks/use-reduced-motion';

/**
 * What the viewer asked of the Short on screen: it plays muted, paused under the `reduced` motion set,
 * and the next Short starts playing again; the mute, the speed and the captions stay chosen.
 */
export function useShortsPlayback() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState<boolean>();
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(false);

  const isPaused = paused ?? reduced;

  return {
    paused: isPaused,
    muted,
    speed,
    captions,
    setPaused,
    setSpeed,
    togglePlay: () => setPaused(!isPaused),
    toggleMute: () => setMuted(!muted),
    toggleCaptions: () => setCaptions(!captions),
    startOver: () => setPaused(undefined),
  };
}
