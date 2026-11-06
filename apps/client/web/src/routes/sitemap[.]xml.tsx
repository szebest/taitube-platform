import { createFileRoute } from '@tanstack/react-router';
import { createApiClient } from '@vp/api-client';
import { API_BASE_URL, WEB_URL } from '#app/lib/config';
import { sitemapResponse } from '#app/lib/seo/sitemap';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => sitemapResponse(createApiClient({ baseUrl: API_BASE_URL }), WEB_URL),
    },
  },
});
