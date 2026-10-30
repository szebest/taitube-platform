import { createFileRoute } from '@tanstack/react-router';
import { createApiClient } from '@vp/api-client';

import { API_BASE_URL, WEB_URL } from '#app/config';
import { videoFeedResponse } from '#app/features/seo/video-feed';

export const Route = createFileRoute('/feeds/videos.xml')({
  server: {
    handlers: {
      GET: () => videoFeedResponse(createApiClient({ baseUrl: API_BASE_URL }), WEB_URL),
    },
  },
});
