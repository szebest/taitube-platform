import type { VideoStatus, VideoVisibility } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { InMemoryRepositories } from '../in-memory-repositories';
import { watchableVideo } from '../watchable-video';

const OWNER = { id: '00000000-0000-7000-8000-000000000101', role: 'USER' as const };
const VIEWER = { id: '00000000-0000-7000-8000-000000000102', role: 'USER' as const };

describe('watchableVideo', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
  });

  async function seed(visibility: VideoVisibility, status: VideoStatus = 'READY') {
    const video = expectOk(
      await repositories.videos.create({
        id: '00000000-0000-7000-8000-00000000000a',
        ownerId: OWNER.id,
        sourceKey: 'raw/a/source.mp4',
        visibility,
        status,
      })
    );
    return video.id;
  }

  const lookups = () => ({ videosRepo: repositories.videos, channelsRepo: repositories.channels });

  it('hands back a public video with its channel card', async () => {
    const found = await watchableVideo(lookups(), VIEWER, await seed('public'));

    expect(found?.channel).toMatchObject({ handle: 'owner', displayName: 'Owner' });
  });

  it.each([
    { scenario: "another user's private video", viewer: VIEWER, visibility: 'private' as const },
    { scenario: 'a deleted video', viewer: OWNER, status: 'DELETED' as const },
  ])('hides $scenario', async ({ viewer, visibility, status }) => {
    const videoId = await seed(visibility ?? 'public', status);

    expect(await watchableVideo(lookups(), viewer, videoId)).toBeNull();
  });

  it('shows the owner their own private video', async () => {
    expect(await watchableVideo(lookups(), OWNER, await seed('private'))).not.toBeNull();
  });
});
