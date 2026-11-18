import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChapterService } from '../chapter-service';
import { creatorStudioOf } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000da';
const CHAPTERS = [
  { startMs: 60_000, title: 'End' },
  { startMs: 0, title: 'Intro' },
  { startMs: 20_000, title: 'Middle' },
];

describe('apps/server/api/services: chapters', () => {
  let repositories: InMemoryRepositories;
  let chapters: ChapterService;

  const version = async () => expectOk(await repositories.videos.findById(VIDEO_ID))?.version ?? -1;

  async function seedTranscript(text: string, status: 'ready' | 'pending' = 'ready') {
    const track = expectOk(
      await repositories.captions.createGenerated({
        id: '00000000-0000-7000-8000-0000000000c1',
        videoId: VIDEO_ID,
        language: 'en',
        modelVersion: 'm',
        status: 'pending',
        reason: null,
      })
    );
    if (status === 'pending') return;
    const cues = Array.from({ length: 48 }, (_, index) => ({
      index,
      startMs: index * 5_000,
      endMs: index * 5_000 + 4_800,
      text: index < 24 ? text : 'airport luggage passport boarding flight terminal',
    }));
    expectOk(
      await repositories.captions.complete({
        id: track.id,
        expectedVersion: track.version,
        language: 'en',
        detectedLanguage: 'en',
        cues,
      })
    );
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    chapters = new ChapterService({
      videos: repositories.videos,
      captions: repositories.captions,
      studio: creatorStudioOf(repositories),
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        title: 'Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/a.mp4',
        durationMs: 240_000,
      })
    );
  });

  it('replaces the set sorted by time and shows it on the video', async () => {
    const view = expectOk(
      await chapters.replace(OWNER, VIDEO_ID, { chapters: CHAPTERS, version: await version() })
    );

    expect(view.chapters.map((chapter) => chapter.title)).toEqual(['Intro', 'Middle', 'End']);
  });

  it.each([
    { name: 'a stale version', patch: { version: -1 }, code: ErrorCodes.VERSION_CONFLICT },
    {
      name: 'two chapters',
      patch: { chapters: CHAPTERS.slice(0, 2) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a last chapter past the end',
      patch: { chapters: [...CHAPTERS, { startMs: 240_000, title: 'x' }] },
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('refuses $name', async ({ patch, code }) => {
    const body = { chapters: CHAPTERS, version: await version(), ...patch };

    expect(expectErr(await chapters.replace(OWNER, VIDEO_ID, body)).code).toBe(code);
  });

  it('refuses a stranger', async () => {
    const failure = expectErr(
      await chapters.replace(STRANGER, VIDEO_ID, { chapters: CHAPTERS, version: await version() })
    );

    expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
  });

  describe('suggest', () => {
    it('cuts the ready transcript where the topic changes and saves nothing', async () => {
      await seedTranscript('chopping onions garlic simmering sauce tomatoes');
      const before = await version();

      const { items } = expectOk(await chapters.suggest(OWNER, VIDEO_ID));

      expect(items.map((item) => item.startMs)).toEqual([0, 120_000]);
      expect(await version()).toBe(before);
    });

    it.each([
      { name: 'no transcript', seed: false },
      { name: 'a transcript still pending', seed: true },
    ])('answers nothing for $name', async ({ seed }) => {
      if (seed) await seedTranscript('x', 'pending');

      expect(expectOk(await chapters.suggest(OWNER, VIDEO_ID)).items).toEqual([]);
    });

    it('refuses a stranger', async () => {
      expect(expectErr(await chapters.suggest(STRANGER, VIDEO_ID)).code).toBe(ErrorCodes.FORBIDDEN);
    });
  });
});
