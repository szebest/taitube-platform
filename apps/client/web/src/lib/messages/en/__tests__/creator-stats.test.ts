import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en creator stats', () => {
  const { t } = translatorFor('en');

  it.each([
    {
      key: 'creatorStats.chartHours',
      args: { peak: '90' },
      expected: 'Views by hour, 90 at the busiest hour',
    },
    {
      key: 'creatorStats.chartDays',
      args: { peak: '900' },
      expected: 'Views by day, 900 on the busiest day',
    },
    {
      key: 'creatorStats.retentionAverage',
      args: { share: '42%' },
      expected: 'The average view watched 42% of the video',
    },
    {
      key: 'creatorStats.dropOff',
      args: { time: '0:42', share: '18%' },
      expected: '0:42, 18% leave here',
    },
    { key: 'creatorStats.dropOffSeek', args: { time: '0:42' }, expected: 'Play from 0:42' },
  ] as const)('renders $key with its arguments', ({ key, args, expected }) => {
    expect(t(key, args)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'creatorStats.private', expected: 'Only you and your team see this' },
    { key: 'creatorStats.live', expected: 'Updating live' },
    { key: 'creatorStats.first48Hours', expected: 'First 48 hours' },
    { key: 'creatorStats.last30Days', expected: 'Last 30 days' },
    { key: 'creatorStats.openAnalytics', expected: 'Open full analytics' },
    { key: 'creatorStats.pin', expected: 'Pin' },
    { key: 'creatorStats.unpin', expected: 'Unpin' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
