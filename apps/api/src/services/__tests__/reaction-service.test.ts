import { InMemoryRepositories } from '@vp/adapters';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { ReactionService } from '../reaction-service';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000a1';
const OWNER_ID = '00000000-0000-7000-8000-0000000000a2';

function makeService(repositories: InMemoryRepositories): ReactionService {
  return new ReactionService({
    videoReactions: repositories.videoReactions,
    videos: repositories.videos,
  });
}

async function seedVideo(repositories: InMemoryRepositories): Promise<void> {
  await repositories.videos.create({
    id: VIDEO_ID,
    ownerId: OWNER_ID,
    title: 'Reactions fixture',
    visibility: 'public',
    status: 'READY',
    sourceKey: 'raw/reactions.mp4',
  });
}

describe('apps/api/services: ReactionService', () => {
  let repositories: InMemoryRepositories;
  let service: ReactionService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = makeService(repositories);
    await seedVideo(repositories);
  });

  it('records a reaction for a role that holds the react permission', async () => {
    const result = await service.setReaction({ id: OWNER_ID, role: 'USER' }, VIDEO_ID, 'LIKE');

    expect(result).toMatchObject({ videoId: VIDEO_ID, reaction: 'LIKE', likesCount: 1 });
  });

  it.each([
    ['GUEST', 'guest'],
    ['unrecognised', 'definitely-not-a-role'],
  ])('refuses a %s caller with FORBIDDEN and writes nothing', async (_label, role) => {
    const caller = { id: OWNER_ID, role };

    await expect(service.setReaction(caller, VIDEO_ID, 'LIKE')).rejects.toMatchObject({
      code: ErrorCodes.FORBIDDEN,
    });
    await expect(
      repositories.videoReactions.getUserReaction(VIDEO_ID, OWNER_ID)
    ).resolves.toBeNull();
  });

  it('refuses before looking the video up, so an unknown video still reads as FORBIDDEN', async () => {
    await expect(
      service.setReaction({ id: OWNER_ID, role: 'GUEST' }, 'missing-video', 'LIKE')
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN });
  });

  it('reports a missing video as VIDEO_NOT_FOUND for a permitted caller', async () => {
    await expect(
      service.setReaction({ id: OWNER_ID, role: 'USER' }, 'missing-video', 'LIKE')
    ).rejects.toBeInstanceOf(PermanentError);
  });

  it('reads back the caller reaction and the aggregate counts', async () => {
    await service.setReaction({ id: OWNER_ID, role: 'USER' }, VIDEO_ID, 'DISLIKE');

    await expect(
      service.getUserReaction({ id: OWNER_ID, role: 'USER' }, VIDEO_ID)
    ).resolves.toEqual({ videoId: VIDEO_ID, reaction: 'DISLIKE' });
    await expect(service.getCounts(VIDEO_ID)).resolves.toMatchObject({
      likesCount: 0,
      dislikesCount: 1,
    });
  });
});
