import type { VideoRecord } from '@vp/core/repositories';
import { firstWeekRowsOf, recentPeersOf } from '../in-memory-first-week';

const OWNER = 'owner';

function video(overrides: Partial<VideoRecord>): VideoRecord {
  return {
    id: 'v1',
    ownerId: OWNER,
    visibility: 'public',
    status: 'READY',
    readyAt: new Date('2026-03-10T23:30:00.000Z'),
    ...overrides,
  } as VideoRecord;
}

describe('in-memory first week', () => {
  it('buckets daily views by their offset from the UTC ready day, inside the first week only', () => {
    const rows = firstWeekRowsOf(
      [video({}), video({ id: 'v2', readyAt: null })],
      [
        { videoId: 'v1', viewDate: '2026-03-10', views: 2, watchSeconds: 0 },
        { videoId: 'v1', viewDate: '2026-03-11', views: 3, watchSeconds: 0 },
        { videoId: 'v1', viewDate: '2026-03-17', views: 9, watchSeconds: 0 },
        { videoId: 'v2', viewDate: '2026-03-10', views: 5, watchSeconds: 0 },
      ]
    );

    expect(rows).toEqual([
      { videoId: 'v1', dayOffset: 0, views: 2 },
      { videoId: 'v1', dayOffset: 1, views: 3 },
    ]);
  });

  it.each([
    ['another owner', { ownerId: 'other' }],
    ['a private video', { visibility: 'private' as const }],
    ['an unfinished video', { status: 'PROCESSING' as const }],
    ['the excluded video', { id: 'excluded' }],
    ['a video ready after the limit', { readyAt: new Date('2026-04-01T00:00:00.000Z') }],
    ['a video that never became ready', { readyAt: null }],
  ])('leaves out %s', (_name, overrides) => {
    expect(recentPeersOf([video(overrides)], OWNER, 'excluded', new Date('2026-03-20'))).toEqual(
      []
    );
  });

  it('lists the peers newest first', () => {
    const older = video({ id: 'a', readyAt: new Date('2026-03-01') });
    const newer = video({ id: 'b', readyAt: new Date('2026-03-05') });

    expect(
      recentPeersOf([older, newer], OWNER, 'excluded', new Date('2026-03-20')).map(
        ({ videoId }) => videoId
      )
    ).toEqual(['b', 'a']);
  });
});
