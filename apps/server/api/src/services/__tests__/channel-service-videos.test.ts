import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelService } from '../channel-service';
import { channelServiceDeps } from './service-deps';

const USER_ID = '018f0000-0000-7000-8000-000000000001';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
const OTHER_USER_ID = '018f0000-0000-7000-8000-000000000003';
const OLDER = '018f0000-0000-7000-8000-0000000000b1';
const NEWER = '018f0000-0000-7000-8000-0000000000b2';
const CARD = {
  id: CHANNEL_ID,
  handle: 'creator',
  displayName: 'Awesome Creator',
  avatarUrl: 'https://cdn.example.com/avatar.png',
};

describe('ChannelService.listVideos', () => {
  let repositories: InMemoryRepositories;
  let channelService: ChannelService;

  const seedVideo = (id: string, overrides: Partial<NewVideoInput> = {}) =>
    repositories.videos.create({
      id,
      ownerId: USER_ID,
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${id}.mp4`,
      ...overrides,
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    channelService = new ChannelService(channelServiceDeps(repositories));
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: USER_ID,
        handle: 'creator',
        displayName: CARD.displayName,
        avatarUrl: CARD.avatarUrl,
      })
    );
    await seedVideo(OLDER);
    await seedVideo(NEWER);
    await seedVideo('018f0000-0000-7000-8000-0000000000b3', { visibility: 'unlisted' });
    await seedVideo('018f0000-0000-7000-8000-0000000000b4', { status: 'PROCESSING' });
    await seedVideo('018f0000-0000-7000-8000-0000000000b5', { ownerId: OTHER_USER_ID });
  });

  it("lists the channel's public ready videos newest first, each under its card", async () => {
    const page = expectOk(await channelService.listVideos('@creator', {}));

    expect(page.items.map(({ id, channel }) => ({ id, channel }))).toEqual([
      { id: NEWER, channel: CARD },
      { id: OLDER, channel: CARD },
    ]);
    expect(page).toMatchObject({ total: 2, nextCursor: null });
  });

  it('resumes the next page from the cursor of the last', async () => {
    const first = expectOk(await channelService.listVideos(CHANNEL_ID, { limit: 1 }));
    const cursor = first.nextCursor ?? undefined;

    const second = expectOk(await channelService.listVideos(CHANNEL_ID, { limit: 1, cursor }));

    expect([...first.items, ...second.items].map(({ id }) => id)).toEqual([NEWER, OLDER]);
    expect(second.nextCursor).toBeNull();
  });

  it.each([
    { name: 'a channel nobody holds', idOrHandle: '@nobody', code: ErrorCodes.CHANNEL_NOT_FOUND },
    { name: 'a cursor it never issued', idOrHandle: '@creator', code: ErrorCodes.INVALID_CURSOR },
  ])('reports $code for $name', async ({ idOrHandle, code }) => {
    const failure = expectErr(await channelService.listVideos(idOrHandle, { cursor: 'nope' }));

    expect(failure.code).toBe(code);
  });
});
