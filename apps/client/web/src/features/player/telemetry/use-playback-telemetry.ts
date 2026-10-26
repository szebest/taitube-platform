import { recordPlayback } from '@vp/api-contracts';
import { sendJsonBeacon } from '@vp/web-telemetry';
import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '#app/config';
import type { PlaybackEnd, PlaybackProgress, PlaybackQuality } from '../taitube-player-props';
import { type PlaybackTracker, createPlaybackTracker } from './playback-tracker';

export function usePlaybackTelemetry(videoId: string) {
  const tracker = useRef<PlaybackTracker | null>(null);

  useEffect(() => {
    const created = createPlaybackTracker({
      videoId,
      sessionUuid: crypto.randomUUID(),
      send: (event) => sendJsonBeacon(`${API_BASE_URL}${recordPlayback.path}`, event),
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
