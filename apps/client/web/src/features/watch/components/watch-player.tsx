import { ClientOnly } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { Suspense, lazy } from 'react';

import { Stage } from '#app/components/watch/stage';
import { useAmbientSample } from '#app/hooks/use-ambient-sample';

export type WatchPlayerProps = Pick<Video, 'id' | 'playbackUrl' | 'posterUrl' | 'title'>;

const TaitubePlayer = lazy(() =>
  import('#app/features/player').then((player) => ({ default: player.TaitubePlayer }))
);

export function WatchPlayer({ id, playbackUrl, posterUrl, title }: WatchPlayerProps) {
  const glowColors = useAmbientSample(posterUrl ?? undefined);
  const poster = posterUrl && (
    <Stage.Poster src={posterUrl} alt={title ?? ''} fetchPriority="high" />
  );

  return (
    <Stage.Root videoId={id} glowColors={glowColors}>
      {playbackUrl ? (
        <ClientOnly fallback={poster}>
          <Suspense fallback={poster}>
            <Stage.Player>
              <TaitubePlayer
                videoId={id}
                playbackUrl={playbackUrl}
                posterUrl={posterUrl}
                title={title}
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
