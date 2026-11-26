import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { VideoEditsService } from '../video-edits-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000c1', role: 'CREATOR' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000ca';
const NOW = Date.parse('2026-03-10T00:00:00.000Z');
const TRIM = { trim: { startMs: 5_000, endMs: 50_000 }, blurs: [] };
const LADDER = [{ name: '720p' }];

describe('apps/server/api/services: video edits', () => {
  let repositories: InMemoryRepositories;
  let edits: VideoEditsService;

  const swapIn = async (generation: number) => {
    expectOk(await repositories.videoGenerations.claim(VIDEO_ID, generation, 'token'));
    expectOk(
      await repositories.videoGenerations.swap({
        videoId: VIDEO_ID,
        generation,
        claim: {
          type: 'render',
          lockToken: 'token',
          playback: {
            masterPlaylistKey: `m${generation}`,
            durationMs: 45_000,
            width: 1280,
            height: 720,
            fps: 30,
            ladder: LADDER,
          },
        },
        now: new Date(NOW),
      })
    );
  };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    edits = new VideoEditsService({
      videos: repositories.videos,
      generations: repositories.videoGenerations,
      traceparent: () => '00-trace-span-01',
      now: () => NOW,
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        status: 'READY',
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        durationMs: 60_000,
        masterPlaylistKey: 'm1',
        ladder: LADDER,
      })
    );
  });

  it('renders a second edit from the same base, not over the first', async () => {
    expectOk(await edits.save(OWNER, VIDEO_ID, TRIM));
    await swapIn(2);

    const second = expectOk(
      await edits.save(OWNER, VIDEO_ID, { trim: { startMs: 0, endMs: 59_000 }, blurs: [] })
    );

    expect(second).toMatchObject({ baseGeneration: 1, generation: 3, status: 'rendering' });
  });

  it('checks a list against the base timeline, which is longer than the trimmed one playing', async () => {
    expectOk(await edits.save(OWNER, VIDEO_ID, TRIM));
    await swapIn(2);

    expect(
      expectOk(
        await edits.save(OWNER, VIDEO_ID, { trim: { startMs: 0, endMs: 58_000 }, blurs: [] })
      )
    ).toMatchObject({ baseGeneration: 1 });
    expect(expectOk(await edits.generations(OWNER, VIDEO_ID)).editBase).toEqual({
      generation: 1,
      durationMs: 60_000,
    });
  });

  it('refuses a second save while one renders', async () => {
    expectOk(await edits.save(OWNER, VIDEO_ID, TRIM));

    expect(expectErr(await edits.save(OWNER, VIDEO_ID, TRIM)).code).toBe(
      ErrorCodes.GENERATION_IN_PROGRESS
    );
  });

  it('lists the generations newest first with the edit list over its base', async () => {
    expectOk(await edits.save(OWNER, VIDEO_ID, TRIM));
    await swapIn(2);

    expect(expectOk(await edits.generations(OWNER, VIDEO_ID))).toMatchObject({
      activeGeneration: 2,
      edit: { baseGeneration: 1, generation: 2, status: 'applied', trim: TRIM.trim },
      items: [
        { generation: 2, kind: 'edit', status: 'active', durationMs: 45_000 },
        { generation: 1, kind: 'upload', status: 'retired', durationMs: 60_000 },
      ],
    });
  });
});
