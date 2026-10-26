import { useQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { VideoCard } from '#app/features/browse/components/video-card/video-card';
import { relatedQueryOptions } from '#app/features/watch/api/related-queries';

export interface RelatedVideosProps {
  videoId: string;
}

export function RelatedVideos({ videoId }: RelatedVideosProps) {
  const api = useApi();
  const { tOr } = useT();

  const { data } = useQuery(relatedQueryOptions(api, videoId));

  if (!data || data.items.length === 0) {
    return null;
  }

  return (
    <section className="tw:flex tw:flex-col tw:gap-4 tw:py-6">
      <h2 className="tw:m-0 tw:text-lg tw:font-bold">{tOr('videos.moreLikeThis', {}, '')}</h2>
      <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] tw:gap-4 tw:p-0">
        {data.items.map((item) => (
          <li key={item.id}>
            <VideoCard video={item} reason={item.reason} />
          </li>
        ))}
      </ul>
    </section>
  );
}
