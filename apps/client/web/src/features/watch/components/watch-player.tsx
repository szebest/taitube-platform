import { ClientOnly } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { Suspense, lazy } from 'react';

export type WatchPlayerProps = Pick<Video, 'playbackUrl' | 'posterUrl' | 'title'>;

const TaitubePlayer = lazy(() =>
  import('#app/features/player').then((player) => ({ default: player.TaitubePlayer }))
);

export function WatchPlayer({ playbackUrl, posterUrl, title }: WatchPlayerProps) {
  const poster = (
    <div className="tw:aspect-video tw:w-full tw:overflow-hidden tw:rounded-lg tw:bg-black">
      {posterUrl && (
        <img src={posterUrl} alt="" fetchPriority="high" className="tw:size-full tw:object-cover" />
      )}
    </div>
  );

  if (!playbackUrl) {
    return poster;
  }

  return (
    <ClientOnly fallback={poster}>
      <Suspense fallback={poster}>
        <TaitubePlayer playbackUrl={playbackUrl} posterUrl={posterUrl} title={title} />
      </Suspense>
    </ClientOnly>
  );
}
