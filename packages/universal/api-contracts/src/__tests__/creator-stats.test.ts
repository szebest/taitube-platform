import { getCreatorStats } from '../creator-stats';

const VIDEO_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const stats = {
  videoId: VIDEO_ID,
  generatedAt: '2026-03-10T13:00:00.000Z',
  lifetime: { views: 10, watchSeconds: 90, likes: 3, comments: 1, subscribersGained: 2 },
  last30Days: {
    views: 10,
    watchSeconds: 90,
    averageViewDurationSeconds: 9,
    daily: [{ date: '2026-03-10', views: 10 }],
  },
  first48Hours: {
    hours: [{ hour: '2026-03-10T13:00:00.000Z', views: 10 }],
    windowEndsAt: '2026-03-12T13:00:00.000Z',
  },
  retention: {
    average: 0.4,
    dropOffs: [{ percent: 10, positionSeconds: 60, lostShare: 0.28 }],
  },
};

describe('packages/api-contracts: creator stats', () => {
  it('is a read of the video under the videos prefix', () => {
    expect(getCreatorStats).toMatchObject({ method: 'GET', path: '/v1/videos/:id/creator-stats' });
  });

  it.each([
    ['a full panel', stats],
    ['a closed window', { ...stats, first48Hours: null }],
    ['no retention yet', { ...stats, retention: { average: null, dropOffs: [] } }],
  ])('reads %s', (_label, value) => {
    expect(getCreatorStats.result.parse(value)).toEqual(value);
  });

  it.each([
    ['a retention above 1', { ...stats, retention: { average: 1.2, dropOffs: [] } }],
    ['a negative count', { ...stats, lifetime: { ...stats.lifetime, comments: -1 } }],
    [
      'a lost share above 1',
      {
        ...stats,
        retention: { average: 0.4, dropOffs: [{ percent: 5, positionSeconds: 3, lostShare: 2 }] },
      },
    ],
  ])('rejects %s', (_label, value) => {
    expect(getCreatorStats.result.safeParse(value).success).toBe(false);
  });
});
