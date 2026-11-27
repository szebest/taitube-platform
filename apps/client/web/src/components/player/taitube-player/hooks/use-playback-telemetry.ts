import { deviceClassOf, sendJsonBeacon } from '@kit/web-telemetry';
import { recordPlayback } from '@vp/api-contracts';
import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '#app/lib/config';
import type { PlaybackAttribution } from '#app/lib/player/playback-attribution';
import type {
  PlaybackEnd,
  PlaybackProgress,
  PlaybackQuality,
} from '#app/lib/player/taitube-player-props';
import { createPlaybackTracker, type PlaybackTracker } from '../utils/playback-tracker';

/** The beacon of one video load; `attribution` may arrive or change mid-load without starting a new session. */
export function usePlaybackTelemetry(videoId: string, attribution: PlaybackAttribution = {}) {
  const tracker = useRef<PlaybackTracker | null>(null);
  const attributed = useRef(attribution);

  useEffect(() => {
    attributed.current = attribution;
  });

  useEffect(() => {
    const created = createPlaybackTracker({
      videoId,
      sessionUuid: crypto.randomUUID(),
      device: deviceClassOf({
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        screenShortSide: Math.min(window.screen.width, window.screen.height),
      }),
      send: (event) =>
        sendJsonBeacon(`${API_BASE_URL}${recordPlayback.path}`, {
          ...event,
          ...attributed.current,
        }),
    });
    const onVisibilityChange = () => created.visibility(document.visibilityState === 'visible');
    tracker.current = created;
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      created.dispose();
      tracker.current = null;
    };
  }, [videoId]);

  return {
    onPlay: (progress: PlaybackProgress) => tracker.current?.play(progress),
    onPause: (progress: PlaybackProgress) => tracker.current?.pause(progress),
    onWaiting: () => tracker.current?.waiting(),
    onTimeUpdate: (progress: PlaybackProgress) => tracker.current?.timeUpdate(progress),
    onEnded: ({ duration }: PlaybackEnd) =>
      tracker.current?.end({ currentTime: duration, duration }),
    onQualityChange: ({ height }: PlaybackQuality) => {
      if (height) {
        tracker.current?.rendition(`${height}p`);
      }
    },
  };
}
