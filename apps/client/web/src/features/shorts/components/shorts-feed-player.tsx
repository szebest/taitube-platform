import { ClientOnly } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { lazy, Suspense } from 'react';

import type { TaitubePlayerProps } from '#app/features/player';

const TaitubePlayer = lazy(() =>
  import('#app/features/player').then((player) => ({ default: player.TaitubePlayer }))
);

export interface ShortsFeedPlayerProps
  extends Pick<
    TaitubePlayerProps,
    'control' | 'onPlay' | 'onPause' | 'onWaiting' | 'onTimeUpdate'
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
        <TaitubePlayer
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
