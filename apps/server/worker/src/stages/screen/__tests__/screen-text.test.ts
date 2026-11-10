import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { screenText } from '../screen-text';

const { thresholds } = STAGE_SETTINGS.screening;

describe('screenText', () => {
  let repositories: InMemoryRepositories;
  let videoId: string;
  let captionId: string;

  async function transcript(
    spoken: readonly string[],
    video: Partial<NewVideoInput> = {}
  ): Promise<void> {
    videoId = uuidv7();
    captionId = uuidv7();
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: SEEDED.userId,
        title: 'A walk',
        status: 'READY',
        visibility: 'public',
        sourceKey: `raw/${videoId}.mp4`,
        ...video,
      })
    );
    const track = expectOk(
      await repositories.captions.createGenerated({
        id: captionId,
        videoId,
        language: 'en',
        modelVersion: 'small-q5_1',
        status: 'pending',
        reason: null,
      })
    );
    expectOk(
      await repositories.captions.complete({
        id: captionId,
        expectedVersion: track.version,
        language: 'en',
        detectedLanguage: 'en',
        cues: spoken.map((text, index) => ({
          index,
          startMs: index * 2000,
          endMs: index * 2000 + 1500,
          text,
        })),
      })
    );
  }

  const run = (enabled = true, language = 'en') =>
    screenText(
      { repositories, screening: { enabled, thresholds } },
      { videoId, captionId, language }
    );
  const flagsOf = async () =>
    expectOk(await repositories.screenings.latestForVideo(videoId))?.flags ?? [];

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  it.each([
    {
      name: 'profanity said in a ready video',
      spoken: ['hello', 'this is shit'],
      video: {},
      raised: true,
    },
    {
      name: 'profanity said in a held video',
      spoken: ['shit'],
      video: { status: 'HELD' as const },
      raised: true,
    },
    { name: 'clean speech', spoken: ['hello there', 'a calm walk'], video: {}, raised: false },
    { name: 'a transcript with no cue rows', spoken: [], video: {}, raised: false },
    {
      name: 'profanity said in a video still processing',
      spoken: ['shit'],
      video: { status: 'PROCESSING' as const },
      raised: false,
    },
  ])('raises a flag for $name: $raised', async ({ spoken, video, raised }) => {
    await transcript(spoken, video);

    expect(expectOk(await run())).toBe(raised);

    expect((await flagsOf()).map(({ reason }) => reason)).toEqual(raised ? ['METADATA_SPAM'] : []);
    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe(
      video.status ?? 'READY'
    );
  });

  it('leaves a held video held and a ready one ready, and never records a hold', async () => {
    await transcript(['shit']);

    await run();

    expect(expectOk(await repositories.screenings.latestForVideo(videoId))).toMatchObject({
      outcome: 'PASS',
      flags: [{ evidence: { source: 'transcript', profanity: ['shit'] } }],
    });
  });

  it('does nothing with screening switched off, for a missing video, and the second time', async () => {
    await transcript(['shit']);

    expect(expectOk(await run(false))).toBe(false);
    expect(expectOk(await run())).toBe(true);
    expect(expectOk(await run())).toBe(false);
    expect(
      expectOk(
        await screenText(
          { repositories, screening: { enabled: true, thresholds } },
          { videoId: uuidv7(), captionId, language: 'en' }
        )
      )
    ).toBe(false);
  });
});
