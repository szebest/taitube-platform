import { ClientOnly } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { Suspense } from 'react';
import type { TaitubePlayerProps } from '#app/components/player/taitube-player';
import { LazyTaitubePlayer } from '#app/components/player/taitube-player/taitube-player.lazy';

export interface ShortsFeedPlayerProps extends Pick<
  TaitubePlayerProps,
  'control' | 'captionTracks' | 'onPlay' | 'onPause' | 'onWaiting'
> {
  short: VideoSummary;
}

/** The Short's player, vertical, on its poster until the browser has it; without a playback URL, the poster alone. */
export function ShortsFeedPlayer({ short, ...handlers }: ShortsFeedPlayerProps) {
  const { id, playbackUrl, posterUrl, title } = short;
  const poster = posterUrl && <img src={posterUrl} alt="" fetchPriority="high" />;

  if (!playbackUrl) {
    return poster;
  }

  return (
    <ClientOnly fallback={poster}>
      <Suspense fallback={poster}>
        <LazyTaitubePlayer
          videoId={id}
          playbackUrl={playbackUrl}
          posterUrl={posterUrl}
          title={title}
          layout="vertical"
          {...handlers}
        />
      </Suspense>
    </ClientOnly>
  );
}
