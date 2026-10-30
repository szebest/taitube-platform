import { createQueryClient } from '@vp/queries';
import { api, VIDEO_ID } from '@vp/web-testing';

import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { analyticsQueryOptions } from '../analytics-queries';

describe('apps/client/studio: analytics queries', () => {
  it.each([
    { scope: { kind: 'channel' }, range: '7d' },
    { scope: { kind: 'video', videoId: VIDEO_ID }, range: '90d' },
  ] as const)(
    'asks the $scope.kind endpoint for $range and answers its timeline',
    async ({ scope, range }) => {
      const requests = serveAnalytics({ views: [4, 6] });

      const analytics = await createQueryClient().fetchQuery(
        analyticsQueryOptions(api, scope, range)
      );

      expect(requests).toEqual([{ scope: scope.kind, range }]);
      expect(analytics.rangeViews).toBe(10);
      expect(analytics.timeline.map(({ views }) => views)).toEqual([4, 6]);
    }
  );

  it.each([
    { name: 'a range', left: ['channel', '7d'], right: ['channel', '30d'] },
    { name: 'a scope', left: ['channel', '30d'], right: ['video', '30d'] },
  ] as const)('keeps $name apart in the cache', ({ left, right }) => {
    const options = ([kind, range]: readonly [string, '7d' | '30d']) =>
      analyticsQueryOptions(
        api,
        kind === 'channel' ? { kind } : { kind: 'video', videoId: VIDEO_ID },
        range
      );

    expect(options(left).queryKey).not.toEqual(options(right).queryKey);
  });
});
