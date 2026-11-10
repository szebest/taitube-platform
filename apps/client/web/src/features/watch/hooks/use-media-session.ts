import type { VideoSummary } from '@vp/api-contracts';
import { useEffect, useEffectEvent } from 'react';

export interface MediaSessionControls {
  video: VideoSummary | undefined;
  onPlay: () => void;
  onPause: () => void;
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
}

/**
 * Tells the system what plays, for a lock screen, a headset and a keyboard's media keys: the title, the
 * channel and the poster, and play, pause, previous and next, the last two only where the queue has one.
 */
export function useMediaSession({
  video,
  onPlay,
  onPause,
  onPrevious,
  onNext,
}: MediaSessionControls) {
  const play = useEffectEvent(onPlay);
  const pause = useEffectEvent(onPause);
  const previous = useEffectEvent(() => onPrevious?.());
  const next = useEffectEvent(() => onNext?.());
  const hasPrevious = onPrevious !== undefined;
  const hasNext = onNext !== undefined;

  useEffect(() => {
    const mediaSession: MediaSession | undefined =
      typeof navigator === 'undefined' ? undefined : Reflect.get(navigator, 'mediaSession');
    if (!mediaSession || !video) return;

    const artwork = video.posterUrl ? [{ src: video.posterUrl }] : [];
    mediaSession.metadata = new MediaMetadata({
      title: video.title ?? '',
      artist: video.channel?.displayName ?? '',
      artwork,
    });
    mediaSession.setActionHandler('play', play);
    mediaSession.setActionHandler('pause', pause);
    mediaSession.setActionHandler('previoustrack', hasPrevious ? previous : null);
    mediaSession.setActionHandler('nexttrack', hasNext ? next : null);

    return () => {
      mediaSession.metadata = null;
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack'] as const) {
        mediaSession.setActionHandler(action, null);
      }
    };
  }, [video, hasPrevious, hasNext]);
}
