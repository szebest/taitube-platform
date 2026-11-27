import { createFakeApi } from '../../__tests__/fake-api';
import { runScenariosOnFake } from '../../__tests__/fake-seed';

describe('seed/scenarios: videos', () => {
  it('uploads every video, then sets the metadata, category and visibility the world gives it', async () => {
    const api = createFakeApi();

    const { all } = await runScenariosOnFake([], api);

    expect(all.find((step) => step.scenario === 'videos')?.detail).toBe(
      '6 videos created, 0 already there'
    );
    const stored = [...api.state.videos.values()];
    expect(stored.map((video) => video.visibility).sort()).toEqual([
      'private',
      'public',
      'public',
      'public',
      'public',
      'unlisted',
    ]);
    expect(stored.every((video) => video.categoryId !== null && video.tags.includes('demo'))).toBe(
      true
    );
  });

  it('uploads nothing for a title the owner already has', async () => {
    const api = createFakeApi();
    await runScenariosOnFake([], api);

    const { all, ports } = await runScenariosOnFake([], api);

    expect(all.find((step) => step.scenario === 'videos')?.detail).toBe(
      '0 videos created, 6 already there'
    );
    expect(api.count().videos).toBe(6);
    expect(ports.uploads).toEqual([]);
  });

  it('fails the step with the upload failure when the rate limit never clears, and the run goes on', async () => {
    const { all } = await runScenariosOnFake([], createFakeApi({ failUploads: 100 }));

    expect(all.find((step) => step.scenario === 'videos')?.status).toBe('failed');
    expect(all.find((step) => step.scenario === 'videos')?.detail).toContain('answered 429');
  });

  it('uploads and leaves the rest alone when there is no worker', async () => {
    const api = createFakeApi();

    const { all, lines } = await runScenariosOnFake([], api, { withWorker: false });

    expect(all.find((step) => step.scenario === 'videos')?.status).toBe('done');
    expect([...api.state.videos.values()].every((video) => video.status === 'UPLOADED')).toBe(true);
    expect(lines.some((line) => line.includes('no worker'))).toBe(true);
  });

  it('replaces an upload a failed run left unfinished instead of waiting on it forever', async () => {
    const api = createFakeApi();
    await runScenariosOnFake([], api);
    const [stale] = [...api.state.videos.values()];
    if (stale) stale.status = 'UPLOADING';

    const { all, lines } = await runScenariosOnFake([], api);

    expect(all.find((step) => step.scenario === 'videos')?.detail).toBe(
      '1 videos created, 5 already there'
    );
    expect(lines.some((line) => line.includes('replacing the unfinished upload'))).toBe(true);
    expect(api.count().videos).toBe(6);
  });
});
