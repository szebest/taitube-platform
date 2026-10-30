import { ClientOnly } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { lazy, Suspense } from 'react';

import { Stage } from '#app/components/watch/stage';
import { useAmbientSample } from '#app/hooks/use-ambient-sample';

export interface WatchStageProps {
  video: Video;
  /** Where playback starts, in seconds. */
  startTime?: number;
}

const TaitubePlayer = lazy(() =>
  import('#app/features/player').then((player) => ({ default: player.TaitubePlayer }))
);

export function WatchStage({ video, startTime }: WatchStageProps) {
  const { id, playbackUrl, posterUrl, title } = video;
  const glowColors = useAmbientSample(posterUrl);
  const poster = posterUrl && (
    <Stage.Poster src={posterUrl} alt={title ?? ''} fetchPriority="high" />
  );

  return (
    <Stage.Root videoId={id} glowColors={glowColors}>
      <Stage.Glow />
      {playbackUrl ? (
        <ClientOnly fallback={poster}>
          <Suspense fallback={poster}>
            <Stage.Player>
              <TaitubePlayer
                videoId={id}
                playbackUrl={playbackUrl}
                posterUrl={posterUrl}
                title={title}
                startTime={startTime}
              />
            </Stage.Player>
          </Suspense>
        </ClientOnly>
      ) : (
        poster
      )}
    </Stage.Root>
  );
}
