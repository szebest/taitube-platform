import { databaseUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { EXPERIMENT_MIN_IMPRESSIONS, MAX_RUNNING_EXPERIMENTS_PER_CHANNEL } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { VideoExperimentService } from '../video-experiment-service';
import { creatorStudioOf } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000003a1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000003a2', role: 'USER' };
const VIDEO = '00000000-0000-7000-8000-0000000003b0';
const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const TITLES = {
  kind: 'title',
  variants: [{ title: 'Control' }, { title: 'Challenger' }],
} as const;
const videoIds = Array.from(
  { length: MAX_RUNNING_EXPERIMENTS_PER_CHANNEL + 1 },
  (_, index) => `00000000-0000-7000-8000-0000000003b${index}`
);

describe('apps/server/api/services: VideoExperimentService', () => {
  let repositories: InMemoryRepositories;
  let service: VideoExperimentService;
  let ids: number;

  const version = async () => expectOk(await repositories.videos.findById(VIDEO))?.version ?? -1;
  const start = async (videoId = VIDEO) => expectOk(await service.create(OWNER, videoId, TITLES));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    ids = 0;
    service = new VideoExperimentService({
      videos: repositories.videos,
      experiments: repositories.videoExperiments,
      studio: creatorStudioOf(repositories),
      newId: () => `00000000-0000-7000-8000-0000000003c${(ids += 1)}`,
      now: () => NOW,
    });
    for (const id of videoIds) {
      expectOk(
        await repositories.videos.create({
          id,
          ownerId: OWNER.id,
          channelId: await seedPrimaryChannel(repositories, OWNER.id),
          title: 'Control',
          visibility: 'public',
          status: 'READY',
          sourceKey: `raw/${id}.mp4`,
        })
      );
    }
  });

  it('starts a running test lettered from the control, with no numbers yet', async () => {
    expect(await start()).toMatchObject({
      videoId: VIDEO,
      kind: 'title',
      status: 'running',
      variants: [
        { id: 'a', title: 'Control', thumbnail: null },
        { id: 'b', title: 'Challenger', thumbnail: null },
      ],
      winnerVariantId: null,
      results: { enoughData: false },
    });
  });

  it.each([
    { scenario: 'a second test on the video', videos: [VIDEO, VIDEO], scope: 'video' },
    { scenario: 'a sixth test on the channel', videos: videoIds, scope: 'channel' },
  ])('refuses $scenario', async ({ videos, scope }) => {
    for (const videoId of videos.slice(0, -1)) await start(videoId);

    expect(expectErr(await service.create(OWNER, videos.at(-1) ?? VIDEO, TITLES))).toMatchObject({
      code: ErrorCodes.EXPERIMENT_LIMIT,
      scope,
    });
  });

  it('refuses a thumbnail test on a video with fewer than two thumbnails', async () => {
    const thumbnails = {
      kind: 'thumbnail',
      variants: [{ thumbnail: { source: 'poster' } }, { thumbnail: { source: 'poster' } }],
    } as const;

    expect(expectErr(await service.create(OWNER, VIDEO, thumbnails)).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
  });

  it.each([
    { impressions: EXPERIMENT_MIN_IMPRESSIONS - 1, enoughData: false, ratio: null },
    { impressions: EXPERIMENT_MIN_IMPRESSIONS, enoughData: true, ratio: 0.5 },
  ])('reports enoughData $enoughData at $impressions impressions a variant', async (row) => {
    const { id } = await start();
    repositories.videoExperiments.addStats(
      (['a', 'b'] as const).map((variantId) => ({
        experimentId: id,
        variantId,
        viewDate: '2026-11-20',
        impressions: row.impressions,
        starts: row.impressions / 2,
        watchSeconds: row.impressions / 2,
      }))
    );

    const [listed] = expectOk(await service.list(OWNER, VIDEO)).items;

    expect(listed?.results.enoughData).toBe(row.enoughData);
    expect(listed?.results.variants.map(({ clickThrough }) => clickThrough)).toEqual([
      row.ratio,
      row.ratio,
    ]);
  });

  it('stops a test without a winner, and refuses to stop it again', async () => {
    const { id } = await start();

    expect(expectOk(await service.stop(OWNER, VIDEO, id))).toMatchObject({
      status: 'stopped',
      winnerVariantId: null,
      endedAt: new Date(NOW).toISOString(),
    });
    expect(expectErr(await service.stop(OWNER, VIDEO, id)).code).toBe(
      ErrorCodes.EXPERIMENT_NOT_RUNNING
    );
  });

  it('applies the winner through the edit under the given version and finishes the test', async () => {
    const { id } = await start();

    const video = expectOk(
      await service.apply(OWNER, VIDEO, id, { variantId: 'b', version: await version() })
    );

    expect(video).toMatchObject({ title: 'Challenger', version: 2 });
    expect(expectOk(await repositories.videoExperiments.find(VIDEO, id))).toMatchObject({
      status: 'finished',
      winnerVariantId: 'b',
    });
  });

  it('changes nothing on a stale version', async () => {
    const { id } = await start();

    expect(
      expectErr(await service.apply(OWNER, VIDEO, id, { variantId: 'b', version: 0 })).code
    ).toBe(ErrorCodes.VERSION_CONFLICT);
    expect(expectOk(await repositories.videoExperiments.find(VIDEO, id))?.status).toBe('running');
  });

  it('answers the written video when a concurrent stop ended the test first', async () => {
    const { id } = await start();
    const end = repositories.videoExperiments.end.bind(repositories.videoExperiments);
    vi.spyOn(repositories.videoExperiments, 'end').mockImplementationOnce(async (...args) => {
      await end(VIDEO, id, { status: 'stopped', winnerVariantId: null, at: new Date(NOW) });
      return end(...args);
    });

    const video = expectOk(
      await service.apply(OWNER, VIDEO, id, { variantId: 'b', version: await version() })
    );

    expect(video.title).toBe('Challenger');
  });

  it('reports a test it could not finish after the write', async () => {
    const { id } = await start();
    vi.spyOn(repositories.videoExperiments, 'end').mockResolvedValueOnce(
      err(databaseUnavailable('end'))
    );

    expect(
      expectErr(await service.apply(OWNER, VIDEO, id, { variantId: 'b', version: await version() }))
        .code
    ).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
  });

  it.each([
    {
      scenario: 'an unknown test',
      variantId: 'b' as const,
      unknown: true,
      code: ErrorCodes.EXPERIMENT_NOT_FOUND,
    },
    {
      scenario: 'a variant the test lacks',
      variantId: 'c' as const,
      unknown: false,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses to apply $scenario', async ({ variantId, unknown, code }) => {
    const { id } = await start();

    expect(
      expectErr(
        await service.apply(OWNER, VIDEO, unknown ? VIDEO : id, {
          variantId,
          version: await version(),
        })
      ).code
    ).toBe(code);
  });

  it('refuses a stranger on a video they can watch with a 403', async () => {
    const { id } = await start();

    expect(
      expectErr(
        await service.apply(STRANGER, VIDEO, id, { variantId: 'b', version: await version() })
      ).code
    ).toBe(ErrorCodes.FORBIDDEN);
  });
});
