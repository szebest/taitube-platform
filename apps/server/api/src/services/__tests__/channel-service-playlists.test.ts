import { randomUUID } from 'node:crypto';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import type { PlaylistVisibility } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelService } from '../channel-service';
import { TEST_CDN, channelServiceDeps } from './service-deps';

const USER_ID = '018f0000-0000-7000-8000-000000000001';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
const OTHER_USER_ID = '018f0000-0000-7000-8000-000000000003';
const VISIBLE = '018f0000-0000-7000-8000-0000000000b1';
const HIDDEN = '018f0000-0000-7000-8000-0000000000b2';
const OLDER = '018f0000-0000-7000-8000-0000000000c1';
const NEWER = '018f0000-0000-7000-8000-0000000000c2';
const PRIVATE = '018f0000-0000-7000-8000-0000000000c3';
const FOREIGN = '018f0000-0000-7000-8000-0000000000c4';

describe('ChannelService.listPlaylists', () => {
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

  const seedPlaylist = async (
    id: string,
    visibility: PlaylistVisibility,
    ownerId = USER_ID,
    updatedAt?: Date
  ) => {
    expectOk(
      await repositories.playlists.create({
        id,
        ownerId,
        title: `List ${id}`,
        description: '',
        visibility,
      })
    );
    const stored = expectOk(await repositories.playlists.findById(id));
    if (stored && updatedAt) stored.updatedAt = updatedAt;
  };

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    channelService = new ChannelService(channelServiceDeps(repositories));
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: USER_ID,
        handle: 'creator',
        displayName: 'Awesome Creator',
      })
    );
    await seedVideo(VISIBLE, { posterKey: 'posters/visible.jpg' });
    await seedVideo(HIDDEN, { visibility: 'private', posterKey: 'posters/hidden.jpg' });
    await seedPlaylist(OLDER, 'public', USER_ID, new Date('2026-01-01T00:00:00.000Z'));
    await seedPlaylist(NEWER, 'public', USER_ID, new Date('2026-02-01T00:00:00.000Z'));
    await seedPlaylist(PRIVATE, 'private');
    await seedPlaylist(FOREIGN, 'public', OTHER_USER_ID);
    for (const videoId of [HIDDEN, VISIBLE]) {
      expectOk(await repositories.playlists.addItem(NEWER, { id: randomUUID(), videoId }));
    }
  });

  it('lists the public playlists of the channel, newest change first, with counts and thumbnails', async () => {
    const page = expectOk(await channelService.listPlaylists('@creator', {}));

    expect(page.nextCursor).toBeNull();
    expect(page.items.map(({ id }) => id)).toEqual([NEWER, OLDER]);
    expect(page.items[0]).toMatchObject({
      videoCount: 1,
      thumbnailUrl: `${TEST_CDN}/posters/visible.jpg`,
      thumbnailUrls: [`${TEST_CDN}/posters/visible.jpg`],
    });
    expect(page.items[1]).toMatchObject({ videoCount: 0, thumbnailUrl: null, thumbnailUrls: [] });
  });

  it('resumes the next page from the cursor of the last', async () => {
    const first = expectOk(await channelService.listPlaylists(CHANNEL_ID, { limit: 1 }));
    const cursor = first.nextCursor ?? undefined;

    const second = expectOk(await channelService.listPlaylists(CHANNEL_ID, { limit: 1, cursor }));

    expect([...first.items, ...second.items].map(({ id }) => id)).toEqual([NEWER, OLDER]);
    expect(second.nextCursor).toBeNull();
  });

  it.each([
    { name: 'a channel nobody holds', idOrHandle: '@nobody', code: ErrorCodes.CHANNEL_NOT_FOUND },
    { name: 'a cursor it never issued', idOrHandle: '@creator', code: ErrorCodes.INVALID_CURSOR },
  ])('reports $code for $name', async ({ idOrHandle, code }) => {
    const failure = expectErr(await channelService.listPlaylists(idOrHandle, { cursor: 'nope' }));

    expect(failure.code).toBe(code);
  });
});
