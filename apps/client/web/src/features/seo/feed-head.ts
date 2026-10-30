import type { VideoSummary } from '@vp/api-contracts';

import { videoItemList } from './json-ld';
import { pageHead } from './page-head';

type FeedHeadOptions = {
  path: string;
  title: string;
  description: string;
  videos: VideoSummary[];
  siteUrl: string;
};

export function feedHead({ videos, ...page }: FeedHeadOptions) {
  return pageHead({
    ...page,
    image: videos[0]?.thumbnailUrl ?? videos[0]?.posterUrl,
    openGraphType: 'website',
    jsonLd: videoItemList(videos, page.siteUrl),
  });
}
