import { ClientOnly } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { lazy, Suspense } from 'react';

import { Stage } from '#app/components/watch/stage';
import { type PlaybackRange, usePlayerTheater } from '#app/features/player';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';
import { useAmbientSample } from '#app/hooks/use-ambient-sample';

export interface WatchStageProps {
  video: Pick<Video, 'id' | 'playbackUrl' | 'posterUrl' | 'title'>;
  /** Where playback starts, in seconds. */
  startTime?: number;
  /** A stretch the player plays on loop instead of the whole video. */
  range?: PlaybackRange;
}

const TaitubePlayer = lazy(() =>
  import('#app/features/player').then((player) => ({ default: player.TaitubePlayer }))
);

export function WatchStage({ video, startTime, range }: WatchStageProps) {
  const { id, playbackUrl, posterUrl, title } = video;
  const glowColors = useAmbientSample(posterUrl);
  const theater = usePlayerTheater();
  const [speed] = usePlaybackPreference('speed');
  const [quality] = usePlaybackPreference('quality');
  const poster = posterUrl && (
    <Stage.Poster src={posterUrl} alt={title ?? ''} fetchPriority="high" />
  );

  return (
    <Stage.Root variant={theater ? 'theater' : 'standard'} videoId={id} glowColors={glowColors}>
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
                range={range}
                defaults={{ speed, quality }}
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
