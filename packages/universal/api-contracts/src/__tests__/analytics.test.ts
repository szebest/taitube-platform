import { getChannelAnalytics, getVideoAnalytics } from '../analytics';

describe('packages/api-contracts: analytics', () => {
  it('serves video and channel analytics under the creator prefix', () => {
    expect(getVideoAnalytics).toMatchObject({
      method: 'GET',
      path: '/v1/creator/videos/:id/analytics',
    });
    expect(getChannelAnalytics).toMatchObject({
      method: 'GET',
      path: '/v1/creator/channel/analytics',
    });
  });

  it('defaults the range to 30 days', () => {
    expect(getVideoAnalytics.query.parse({})).toEqual({ range: '30d' });
  });

  it.each(['7d', '30d', '90d'])('accepts the %s range', (range) => {
    expect(getChannelAnalytics.query.parse({ range }).range).toBe(range);
  });

  it('rejects a range outside the three offered', () => {
    expect(getChannelAnalytics.query.safeParse({ range: '365d' }).success).toBe(false);
  });

  it('keeps retention a share between 0 and 1, or null', () => {
    const base = {
      videoId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      range: '7d',
      from: '2026-03-04',
      to: '2026-03-10',
      timeline: [],
      rangeViews: 0,
      totalViews: 0,
      averageDailyViews: 0,
    };

    expect(getVideoAnalytics.result.safeParse({ ...base, averageRetention: null }).success).toBe(
      true
    );
    expect(getVideoAnalytics.result.safeParse({ ...base, averageRetention: 1.2 }).success).toBe(
      false
    );
  });

  it('refuses a stranger with 403 and hides a video they cannot see with 404', () => {
    expect(getVideoAnalytics.errors[403]).toContain('FORBIDDEN');
    expect(getVideoAnalytics.errors[404]).toContain('VIDEO_NOT_FOUND');
  });
});
