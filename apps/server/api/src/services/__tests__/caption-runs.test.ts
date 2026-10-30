import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { committed, startCaptionRun } from '../caption-runs';
import { CAPTIONED, seedCaptionVideos, seedTrack, UNPROBED } from './caption-fixture';

describe('caption runs', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await seedCaptionVideos(repositories);
  });

  const deps = (enabled: boolean) => ({
    captions: repositories.captions,
    outbox: repositories.outbox,
    settings: { enabled, modelVersion: 'small-q5_1' },
  });

  async function video(id: string) {
    const found = expectOk(await repositories.videos.findById(id));
    if (!found) throw new Error(`no video ${id}`);
    return found;
  }

  async function queued() {
    return expectOk(await repositories.outbox.claimBatch(10)).filter(
      (item) => item.kind === 'captions'
    );
  }

  it.each([
    { name: 'a measured video', videoId: CAPTIONED, enabled: true, runs: 1 },
    { name: 'captions off for the platform', videoId: CAPTIONED, enabled: false, runs: 0 },
    { name: 'a video probe has not measured', videoId: UNPROBED, enabled: true, runs: 0 },
  ])(
    'writes a pending track and enqueues $runs run(s) for $name',
    async ({ videoId, enabled, runs }) => {
      const track = expectOk(
        await startCaptionRun(deps(enabled), await video(videoId), null, null, {})
      );

      expect(track).toMatchObject({ kind: 'auto', status: 'pending', videoId });
      expect(await queued()).toHaveLength(runs);
    }
  );

  it('runs the regenerated track at its new version, keyed by it', async () => {
    const ready = await seedTrack(repositories, {
      id: '00000000-0000-7000-8000-00000000cd01',
      kind: 'auto',
    });

    const track = expectOk(
      await startCaptionRun(deps(true), await video(CAPTIONED), ready, 'en', {})
    );

    expect(track.version).toBe(ready.version + 1);
    expect((await queued())[0]?.payload).toMatchObject({
      type: 'flow',
      flow: {
        queueName: 'captions',
        opts: { jobId: `${CAPTIONED}--captions--small-q5_1--v${track.version}` },
        data: { captionId: ready.id, captionVersion: track.version, language: 'en' },
      },
    });
  });

  it('answers VERSION_CONFLICT when the track moved on under the regenerate', async () => {
    const ready = await seedTrack(repositories, {
      id: '00000000-0000-7000-8000-00000000cd02',
      kind: 'auto',
    });
    const stale = { ...ready, version: ready.version - 1 };

    const refused = expectErr(
      await startCaptionRun(deps(true), await video(CAPTIONED), stale, null, {})
    );

    expect(refused).toMatchObject({ code: ErrorCodes.VERSION_CONFLICT, id: ready.id });
    expect(await queued()).toEqual([]);
  });

  it.each([{ type: 'stale' as const }, { type: 'language-taken' as const }])(
    'reads a $type commit as a version conflict',
    (commit) => {
      expect(expectErr(committed(commit, 'c1', 3))).toMatchObject({
        code: ErrorCodes.VERSION_CONFLICT,
        expectedVersion: 3,
      });
    }
  );
});
