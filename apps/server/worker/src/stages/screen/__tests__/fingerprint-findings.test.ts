import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes, TransientError } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { fingerprintFindings } from '../fingerprint-findings';
import { BLANK_FRAMES, framesOf, toolsFor } from './screen-harness';

const input = (videoId: string, hasAudio = false) => ({
  videoId,
  ownerId: SEEDED.userId,
  sourcePath: '/tmp/in.mp4',
  durationMs: 30_000,
  hasAudio,
  signal: new AbortController().signal,
});

describe('fingerprintFindings', () => {
  let repositories: InMemoryRepositories;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  const run = (tools: ReturnType<typeof toolsFor>, videoId: string, hasAudio = false) =>
    fingerprintFindings(
      {
        repositories,
        fingerprint: tools,
        ffmpegPath: 'ffmpeg',
        fpcalcPath: 'fpcalc',
        limits: STAGE_SETTINGS.ffmpegProcess,
        screening: STAGE_SETTINGS.screening,
      },
      input(videoId, hasAudio)
    );

  async function stored(frames = framesOf(1, 15)) {
    const videoId = uuidv7();
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: SEEDED.userId,
        title: 't',
        status: 'READY',
        sourceKey: 'raw/x.mp4',
      })
    );
    expectOk(await run(toolsFor({ frames }), videoId));
    return videoId;
  }

  it('finds nothing in a video the catalogue has not seen, and stores it for the next', async () => {
    const videoId = uuidv7();

    expect(expectOk(await run(toolsFor({ frames: framesOf(2, 15) }), videoId))).toEqual([]);
    const later = expectOk(await run(toolsFor({ frames: framesOf(2, 15) }), uuidv7()));
    expect(later).toEqual([]);
  });

  it('matches a stored video, leaving out one the catalogue no longer has', async () => {
    const original = await stored();
    expectOk(
      await repositories.videos.transition({
        videoId: original,
        from: 'READY',
        to: 'DELETED',
        eventType: 'video.deleted',
        eventPayload: {},
        patch: { deletedAt: new Date() },
      })
    );

    const found = expectOk(await run(toolsFor({ frames: framesOf(1, 15) }), uuidv7()));

    expect(found).toEqual([]);
  });

  it('reports a blank picture beside the matches', async () => {
    const [finding] = expectOk(await run(toolsFor({ frames: BLANK_FRAMES }), uuidv7()));

    expect(finding).toMatchObject({ reason: 'BLANK', score: 1 });
  });

  it.each([
    { hasAudio: true, calls: 1 },
    { hasAudio: false, calls: 0 },
  ])('runs fpcalc $calls times when hasAudio is $hasAudio', async ({ hasAudio, calls }) => {
    const tools = toolsFor({ frames: framesOf(3, 15), terms: [1, 2] });

    expectOk(await run(tools, uuidv7(), hasAudio));

    expect(tools.calls.filter((call) => call === 'runFpcalc')).toHaveLength(calls);
  });

  it('returns the failure of a process that cannot read the source', async () => {
    const tools = toolsFor({ frames: [] });
    tools.sampleFrames = async () => {
      throw new TransientError(ErrorCodes.FFMPEG_FAILED, 'killed');
    };

    expect(expectErr(await run(tools, uuidv7())).code).toBe(ErrorCodes.FFMPEG_FAILED);
  });
});
