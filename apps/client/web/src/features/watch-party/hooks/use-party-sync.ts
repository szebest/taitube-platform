import type { WatchPartyClientFrame } from '@vp/api-contracts';
import { WATCH_PARTY_DRIFT, type WatchPartyPlayback } from '@vp/domain';
import type { WatchPartyState } from '@vp/queries';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { usePlayerCommands, usePlayerState } from '#app/integrations/video-js/video-js-engine';
import { planPartySync } from '../utils/plan-party-sync';

const MS_PER_SECOND = 1000;

export interface PartySyncOptions {
  state: WatchPartyState;
  /** The room's server clock now. */
  serverNow: () => number;
  send: (frame: WatchPartyClientFrame) => boolean;
}

interface SyncMemory {
  cooldownUntil: number;
  hardSeeks: number;
  driftMs: number;
  askedToPlay: boolean;
}

/**
 * Makes the player inside whose tree it runs show the room's clock: the drift driver, the buffering
 * and end reports, and the muted retry when the browser refuses to autoplay with sound. `catchingUp`
 * is true while it nudges or seeks the player toward the room.
 */
export function usePartySync({ state, serverNow, send }: PartySyncOptions) {
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const memory = useRef<SyncMemory>({
    cooldownUntil: 0,
    hardSeeks: 0,
    driftMs: 0,
    askedToPlay: false,
  });
  const reportedBuffering = useRef(false);

  const loaded = usePlayerState((player) => player.duration > 0);
  const paused = usePlayerState((player) => player.paused);
  const buffering = usePlayerState((player) => player.buffering);
  const ended = usePlayerState((player) => player.ended);
  const currentTime = usePlayerState((player) => player.currentTime);
  const rate = usePlayerState((player) => player.playbackRate);
  const { play, pause, seek, setPlaybackRate, setMuted } = usePlayerCommands();
  const { playback, version, rolesVersion } = state;

  const check = useEffectEvent((room: WatchPartyPlayback, isLoaded: boolean) => {
    if (!isLoaded) {
      return;
    }

    const plan = planPartySync({
      playback: room,
      serverNow: serverNow(),
      now: Date.now(),
      player: { paused, buffering, positionMs: currentTime * MS_PER_SECOND, rate },
      cooldownUntil: memory.current.cooldownUntil,
      playRefused: memory.current.askedToPlay && paused,
    });

    setCatchingUp(plan.steps.some((step) => step.type === 'rate' || step.type === 'seek'));
    memory.current.cooldownUntil = plan.cooldownUntil;
    memory.current.driftMs = plan.driftMs;
    memory.current.askedToPlay = plan.steps.some((step) => step.type === 'play');
    if (plan.hardSeek) {
      memory.current.hardSeeks += 1;
    }
    for (const step of plan.steps) {
      switch (step.type) {
        case 'play':
          play();
          break;
        case 'pause':
          pause();
          break;
        case 'mute':
          setMuted(true);
          setSoundBlocked(true);
          break;
        case 'seek':
          seek(step.positionMs / MS_PER_SECOND);
          break;
        case 'rate':
          setPlaybackRate(step.rate);
          break;
      }
    }
  });

  const reportStats = useEffectEvent(() => {
    send({
      type: 'stats',
      driftMs: Math.abs(memory.current.driftMs),
      hardSeeks: memory.current.hardSeeks,
    });
  });

  const reportBuffering = useEffectEvent((isBuffering: boolean) => {
    if (reportedBuffering.current !== isBuffering) {
      reportedBuffering.current = isBuffering;
      send({ type: 'buffering', buffering: isBuffering });
    }
  });

  const reportEnd = useEffectEvent((itemId: string) => {
    send({ type: 'ended', itemId, version, rolesVersion });
  });

  useEffect(() => {
    check(playback, loaded);
    const timer = setInterval(() => check(playback, loaded), WATCH_PARTY_DRIFT.checkIntervalMs);

    return () => clearInterval(timer);
  }, [playback, loaded]);

  useEffect(() => {
    const timer = setInterval(reportStats, WATCH_PARTY_DRIFT.reportIntervalMs);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    reportBuffering(buffering);
  }, [buffering]);

  useEffect(() => {
    if (ended && playback.itemId) {
      reportEnd(playback.itemId);
    }
  }, [ended, playback.itemId]);

  const enableSound = () => {
    setMuted(false);
    setSoundBlocked(false);
  };

  return { soundBlocked, enableSound, catchingUp };
}
