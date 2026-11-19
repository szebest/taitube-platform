import { getVideoAudience, getVideoBenchmark } from '../video-audience';

const videoId = '0f8fad5b-d9cb-469f-a165-70867728950e';

function day(day: number, overrides = {}) {
  return { day, views: day * 10, p25: 5, median: 10, p75: 15, ...overrides };
}

describe('packages/api-contracts: video audience', () => {
  it('serves the audience and the benchmark under the creator video', () => {
    expect(getVideoAudience).toMatchObject({
      method: 'GET',
      path: '/v1/creator/videos/:id/audience',
      scope: 'analytics:read',
    });
    expect(getVideoBenchmark).toMatchObject({
      method: 'GET',
      path: '/v1/creator/videos/:id/benchmark',
      scope: 'analytics:read',
    });
  });

  it.each([[getVideoAudience.errors], [getVideoBenchmark.errors]])(
    'refuses a guest, a stranger and an unseen video',
    (errors) => {
      expect(errors[401]).toContain('UNAUTHORIZED');
      expect(errors[403]).toContain('FORBIDDEN');
      expect(errors[404]).toContain('VIDEO_NOT_FOUND');
    }
  );

  it('defaults the audience range to 30 days', () => {
    expect(getVideoAudience.query.parse({})).toEqual({ range: '30d' });
  });

  it.each(['7d', '30d', '90d', 'lifetime'])('accepts the %s range', (range) => {
    expect(getVideoAudience.query.parse({ range }).range).toBe(range);
  });

  it.each(['365d'])('rejects the %s range', (range) => {
    expect(getVideoAudience.query.safeParse({ range }).success).toBe(false);
  });

  it.each([
    ['a share above one', { devices: [{ device: 'mobile', views: 1, share: 1.2 }] }],
    ['a device nobody reports', { devices: [{ device: 'watch', views: 1, share: 1 }] }],
  ])('rejects an audience with %s', (_name, overrides) => {
    const audience = { videoId, range: '7d', from: '2026-03-04', to: '2026-03-10', devices: [] };

    expect(getVideoAudience.result.safeParse(audience).success).toBe(true);
    expect(getVideoAudience.result.safeParse({ ...audience, ...overrides }).success).toBe(false);
  });

  it.each([
    ['an envelope', [day(0), day(1, { views: null })]],
    ['no envelope', [day(0, { p25: null, median: null, p75: null })]],
  ])('accepts a benchmark with %s', (_name, days) => {
    const benchmark = { videoId, publishedAt: '2026-03-10T09:00:00.000Z', peerCount: 4, days };

    expect(getVideoBenchmark.result.safeParse(benchmark).success).toBe(true);
  });

  it.each([
    ['a day past the first week', { days: [day(7)] }],
    ['more peers than the limit', { peerCount: 11 }],
  ])('rejects a benchmark with %s', (_name, overrides) => {
    const benchmark = { videoId, publishedAt: null, peerCount: 0, days: [day(0)] };

    expect(getVideoBenchmark.result.safeParse({ ...benchmark, ...overrides }).success).toBe(false);
  });
});
