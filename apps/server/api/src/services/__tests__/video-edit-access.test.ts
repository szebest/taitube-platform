import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { editableVideo } from '../video-edit-access';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000f1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000f2', role: 'USER' };
const PUBLIC = '00000000-0000-7000-8000-0000000000f3';
const PRIVATE = '00000000-0000-7000-8000-0000000000f4';
const ABSENT = '00000000-0000-7000-8000-0000000000f5';

describe('apps/server/api/services: editableVideo', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    for (const [id, visibility] of [
      [PUBLIC, 'public'],
      [PRIVATE, 'private'],
    ] as const) {
      expectOk(
        await repositories.videos.create({
          id,
          ownerId: OWNER.id,
          channelId: await seedPrimaryChannel(repositories, OWNER.id),
          title: 'Mine',
          visibility,
          status: 'READY',
          sourceKey: `raw/${id}.mp4`,
        })
      );
    }
  });

  it('hands the owner the video', async () => {
    expect(expectOk(await editableVideo(repositories.videos, OWNER, PRIVATE)).id).toBe(PRIVATE);
  });

  it.each([
    { scenario: 'a video they can watch', videoId: PUBLIC, code: ErrorCodes.FORBIDDEN },
    { scenario: 'a private video', videoId: PRIVATE, code: ErrorCodes.VIDEO_NOT_FOUND },
    { scenario: 'a missing video', videoId: ABSENT, code: ErrorCodes.VIDEO_NOT_FOUND },
  ])('refuses a stranger $scenario with $code', async ({ videoId, code }) => {
    expect(expectErr(await editableVideo(repositories.videos, STRANGER, videoId)).code).toBe(code);
  });
});
