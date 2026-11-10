import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { metadataFinding } from '../metadata-finding';

const { thresholds, process } = STAGE_SETTINGS.screening;

describe('metadataFinding', () => {
  let repositories: InMemoryRepositories;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  async function upload(title: string, description = '') {
    const video = expectOk(
      await repositories.videos.create({
        id: uuidv7(),
        ownerId: SEEDED.userId,
        title,
        description,
        status: 'READY',
        visibility: 'public',
        sourceKey: `raw/${title}.mp4`,
      })
    );
    return video;
  }

  const find = async (video: Awaited<ReturnType<typeof upload>>) =>
    expectOk(await metadataFinding(repositories.videos, video, thresholds, process));

  it.each([
    { scenario: 'a plain title', title: 'Morning walk by the lake', expected: null },
    { scenario: 'a profane English title', title: 'This is shit', expected: 'METADATA_SPAM' },
    { scenario: 'a profane Polish title', title: 'To jest kurwa dobre', expected: 'METADATA_SPAM' },
  ])('finds nothing or spam in $scenario', async ({ title, expected }) => {
    const finding = await find(await upload(title));

    expect(finding?.reason ?? null).toBe(expected);
  });

  it('counts the same title as one of the creator earlier uploads, and never the video itself', async () => {
    await upload('Same title again');
    const second = await upload('Same title again');

    const finding = await find(second);

    expect(finding?.evidence.signals).toContain('sameTitle');
  });

  it('reads no hit into the first upload of a title', async () => {
    expect(await find(await upload('A title nobody used'))).toBeNull();
  });
});
