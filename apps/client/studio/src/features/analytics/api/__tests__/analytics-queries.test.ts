import { createQueryClient } from '@vp/queries';
import { api, apiServer, VIDEO_ID } from '@vp/web-testing';
import {
  analyticsHandlers,
  serveAnalytics,
} from '#app/features/analytics/__tests__/analytics-api.fixture';
import {
  analyticsQueryOptions,
  videoAudienceQueryOptions,
  videoBenchmarkQueryOptions,
} from '../analytics-queries';

describe('apps/client/studio: analytics queries', () => {
  it.each([
    { scope: { kind: 'channel' }, range: '7d' },
    { scope: { kind: 'video', videoId: VIDEO_ID }, range: '90d' },
  ] as const)(
    'asks the $scope.kind endpoint for $range and answers its timeline',
    async ({ scope, range }) => {
      const requests = serveAnalytics({ views: [4, 6] });

      const analytics = await createQueryClient().query(analyticsQueryOptions(api, scope, range));

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

  it.each([
    { range: '7d', asked: '7d' },
    { range: '90d', asked: '90d' },
    { range: 'lifetime', asked: 'lifetime' },
  ] as const)(
    'asks for the $asked device split under the $range range',
    async ({ range, asked }) => {
      const { handlers, audienceRanges } = analyticsHandlers();
      apiServer.use(...handlers);

      const audience = await createQueryClient().query(
        videoAudienceQueryOptions(api, VIDEO_ID, range)
      );

      expect(audienceRanges).toEqual([asked]);
      expect(audience.devices.map(({ device }) => device)).toEqual(['mobile', 'desktop']);
    }
  );

  it.each([
    { left: '7d', right: '30d' },
    { left: '90d', right: 'lifetime' },
  ] as const)('keeps the audience of $left and $right apart in the cache', ({ left, right }) => {
    expect(videoAudienceQueryOptions(api, VIDEO_ID, left).queryKey).not.toEqual(
      videoAudienceQueryOptions(api, VIDEO_ID, right).queryKey
    );
  });

  it('answers the first week of the video with the days of the benchmark', async () => {
    serveAnalytics({ peerCount: 4 });

    const benchmark = await createQueryClient().query(videoBenchmarkQueryOptions(api, VIDEO_ID));

    expect(benchmark.days).toHaveLength(7);
    expect(benchmark.peerCount).toBe(4);
  });
});
