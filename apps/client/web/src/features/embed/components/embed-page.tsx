import { useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly, useParams, useSearch } from '@tanstack/react-router';
import { useApi, videoQueryOptions } from '@vp/queries';
import { Suspense } from 'react';

import { TaitubePlayer } from '#app/features/player';

/** `/embed/$videoId`: the player alone, filling the frame the embedder gave it. */
export function EmbedPage() {
  const { videoId } = useParams({ from: '/embed/$videoId' });
  const { autoplay, t, controls, loop } = useSearch({ from: '/embed/$videoId' });
  const api = useApi();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));

  const poster = video.posterUrl && (
    <img src={video.posterUrl} alt={video.title ?? ''} className="size-full object-contain" />
  );

  return (
    <main className="h-dvh w-dvw overflow-hidden bg-bg">
      {video.playbackUrl ? (
        <ClientOnly fallback={poster}>
          <Suspense fallback={poster}>
            <TaitubePlayer
              videoId={video.id}
              playbackUrl={video.playbackUrl}
              posterUrl={video.posterUrl}
              title={video.title}
              layout="fill"
              startTime={t}
              controls={controls !== 0}
              loop={loop === 1}
              control={autoplay === 1 ? { paused: false, muted: true } : undefined}
            />
          </Suspense>
        </ClientOnly>
      ) : (
        poster
      )}
    </main>
  );
}
