import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { MetadataScreening } from '../metadata-screening';

const OWNER_ID = '00000000-0000-7000-8000-0000000006b1';
const VIDEO_ID = '00000000-0000-7000-8000-0000000006b2';
const { thresholds, process } = inProcessAppConfig().screening;

describe('apps/server/api/services: metadata screening', () => {
  let repositories: InMemoryRepositories;

  const screening = (on = true) =>
    new MetadataScreening({
      screenings: repositories.screenings,
      videos: repositories.videos,
      enabled: on,
      thresholds,
      locales: process.metadataLocales,
      recentTitleCount: process.recentTitleCount,
    });

  async function upload(overrides: Partial<NewVideoInput>) {
    return expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER_ID,
        title: 'A calm walk',
        status: 'READY',
        visibility: 'public',
        sourceKey: 'raw/walk.mp4',
        ...overrides,
      })
    );
  }

  const flagsOf = async () =>
    expectOk(await repositories.screenings.latestForVideo(VIDEO_ID))?.flags.map(
      ({ reason }) => reason
    ) ?? [];

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  it.each([
    {
      name: 'profane text on a ready video',
      video: { title: 'This is shit' },
      flagged: true,
      on: true,
    },
    {
      name: 'profane text on a held video',
      video: { title: 'This is shit', status: 'HELD' as const },
      flagged: true,
      on: true,
    },
    { name: 'clean text', video: { title: 'A calm walk' }, flagged: false, on: true },
    {
      name: 'profane text on a video still processing',
      video: { title: 'This is shit', status: 'PROCESSING' as const },
      flagged: false,
      on: true,
    },
    {
      name: 'profane text on a rejected video',
      video: { title: 'This is shit', status: 'REJECTED' as const },
      flagged: false,
      on: true,
    },
    {
      name: 'profane text with screening switched off',
      video: { title: 'This is shit' },
      flagged: false,
      on: false,
    },
  ])('raises a flag for $name: $flagged', async ({ video, flagged, on }) => {
    const stored = await upload(video);

    const raised = expectOk(await screening(on).flag(stored));

    expect(raised).toBe(flagged);
    expect(await flagsOf()).toEqual(flagged ? ['METADATA_SPAM'] : []);
    expect(expectOk(await repositories.videos.findById(VIDEO_ID))?.status).toBe(stored.status);
  });

  it('flags the same text once, and the same title as an earlier upload', async () => {
    await upload({ id: '00000000-0000-7000-8000-0000000006b3', title: 'Same title again' });
    const second = await upload({ title: 'Same title again' });

    expect(expectOk(await screening().flag(second))).toBe(true);
    expect(expectOk(await screening().flag(second))).toBe(false);
    expect(await flagsOf()).toEqual(['METADATA_SPAM']);
  });
});
