import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { ViewerProgress } from '../viewer-progress';

const VIEWER = { id: '00000000-0000-7000-8000-000000000101', role: 'USER' } as const;
const WATCHED = '00000000-0000-7000-8000-00000000000a';
const FRESH = '00000000-0000-7000-8000-00000000000b';

describe('apps/server/api/services: ViewerProgress', () => {
  const setup = async () => {
    const repositories = new InMemoryRepositories();
    await repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-000000000701',
      userId: VIEWER.id,
      videoId: WATCHED,
      progressSeconds: 42,
      durationSeconds: 100,
      watchedAt: new Date('2026-03-01T12:00:00.000Z'),
    });
    return { repositories, progress: new ViewerProgress(repositories.watchHistory) };
  };

  it('marks each video with the caller playhead, or null when never watched', async () => {
    const { progress } = await setup();

    const attached = await progress.attach(VIEWER, [{ id: WATCHED }, { id: FRESH }]);

    expect(attached).toEqual([
      { id: WATCHED, viewer: { progressSeconds: 42, watchedAt: '2026-03-01T12:00:00.000Z' } },
      { id: FRESH, viewer: null },
    ]);
  });

  it('leaves the videos untouched for an anonymous caller', async () => {
    const { progress } = await setup();

    expect(await progress.attach(null, [{ id: WATCHED }])).toEqual([{ id: WATCHED }]);
  });

  it('reads the playheads once for the whole page', async () => {
    const { repositories, progress } = await setup();
    const findMany = vi.spyOn(repositories.watchHistory, 'findMany');

    await progress.attach(VIEWER, [{ id: WATCHED }, { id: FRESH }]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(VIEWER.id, [WATCHED, FRESH]);
  });

  it('serves the videos without progress when the read fails', async () => {
    const { repositories, progress } = await setup();
    vi.spyOn(repositories.watchHistory, 'findMany').mockResolvedValue(
      err(databaseUnavailable.during('findMany')(new Error('down')))
    );

    expect(await progress.attach(VIEWER, [{ id: WATCHED }])).toEqual([{ id: WATCHED }]);
  });
});
