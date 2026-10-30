import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { manageCaptions, readCaptions } from '../caption-access';
import {
  CAPTION_OWNER,
  CAPTION_STRANGER,
  CAPTIONED,
  PRIVATE_CAPTIONED,
  seedCaptionVideos,
} from './caption-fixture';

const ABSENT = '00000000-0000-7000-8000-00000000ce99';

describe('caption access', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await seedCaptionVideos(repositories);
  });

  it.each([
    { who: 'an anonymous viewer', viewer: null, manager: false },
    { who: 'the owner', viewer: CAPTION_OWNER, manager: true },
  ])('reads a public video captions as $who, managing: $manager', async ({ viewer, manager }) => {
    const access = expectOk(await readCaptions(repositories.videos, viewer, CAPTIONED));

    expect(access).toMatchObject({ video: { id: CAPTIONED }, manager });
  });

  it.each([
    {
      name: 'a stranger on a private video',
      videoId: PRIVATE_CAPTIONED,
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'an absent video', videoId: ABSENT, code: ErrorCodes.VIDEO_NOT_FOUND },
  ])('refuses $name with $code', async ({ videoId, code }) => {
    expect(expectErr(await readCaptions(repositories.videos, CAPTION_STRANGER, videoId)).code).toBe(
      code
    );
  });

  it.each([
    { who: 'the owner', actor: CAPTION_OWNER, ok: true },
    { who: 'a stranger', actor: CAPTION_STRANGER, ok: false },
  ])('lets $who manage: $ok', async ({ actor, ok }) => {
    expect((await manageCaptions(repositories.videos, actor, CAPTIONED)).ok).toBe(ok);
  });
});
