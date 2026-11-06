import { ClientOnly } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { Suspense } from 'react';
import { type PlaybackRange, usePlayerTheater } from '#app/components/player/taitube-player';
import { Stage } from '#app/components/watch/stage';
import { useAmbientSample } from '#app/hooks/use-ambient-sample';
import { PlayerSlot } from '../player-slot/player-slot';
import { WatchPlayer } from '../watch-player/watch-player';

export interface WatchStageProps {
  video: Pick<Video, 'id' | 'playbackUrl' | 'posterUrl' | 'title'>;
  /** A stretch the player plays on loop instead of the whole video; the stage then holds its own player, outside the queue. */
  range?: PlaybackRange;
}

export function WatchStage({ video, range }: WatchStageProps) {
  const { id, playbackUrl, posterUrl, title } = video;
  const glowColors = useAmbientSample(posterUrl);
  const theater = usePlayerTheater();
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
              {range ? (
                <WatchPlayer
                  videoId={id}
                  playbackUrl={playbackUrl}
                  posterUrl={posterUrl}
                  title={title}
                  range={range}
                />
              ) : (
                <PlayerSlot />
              )}
            </Stage.Player>
          </Suspense>
        </ClientOnly>
      ) : (
        poster
      )}
    </Stage.Root>
  );
}
