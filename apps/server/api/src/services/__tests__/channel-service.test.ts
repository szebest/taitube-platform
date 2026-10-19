import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelService } from '../channel-service';
import { channelServiceDeps } from './service-deps';

describe('ChannelService', () => {
  let repositories: InMemoryRepositories;
  let channelService: ChannelService;

  const USER_ID = '018f0000-0000-7000-8000-000000000001';
  const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
  const CHANNELLESS_USER_ID = '018f0000-0000-7000-8000-000000000003';

  async function seedChannellessUser(): Promise<void> {
    expectOk(
      await repositories.users.upsert({
        id: CHANNELLESS_USER_ID,
        email: 'nochannel@example.com',
        tier: 'free',
      })
    );
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    channelService = new ChannelService(channelServiceDeps(repositories));

    expectOk(
      await repositories.users.upsert({
        id: USER_ID,
        email: 'creator@example.com',
        tier: 'pro',
      })
    );

    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: USER_ID,
        handle: 'creator',
        displayName: 'Awesome Creator',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        bannerUrl: 'https://cdn.example.com/banner.png',
        bio: 'Hello world!',
        subscriberCount: 42,
      })
    );
  });

  describe('getAccount', () => {
    it('returns user account and associated channel details', async () => {
      const account = expectOk(await channelService.getAccount({ id: USER_ID, role: 'CREATOR' }));

      expect(account.id).toBe(USER_ID);
      expect(account.role).toBe('CREATOR');
      expect(account.email).toBe('creator@example.com');
      expect(account.tier).toBe('pro');
      expect(account.channel.handle).toBe('creator');
      expect(account.channel.displayName).toBe('Awesome Creator');
      expect(account.channel.subscriberCount).toBe(42);
    });

    it('reports UNAUTHORIZED if the user does not exist', async () => {
      const failure = expectErr(
        await channelService.getAccount({
          id: '00000000-0000-7000-8000-000000000999',
          role: 'USER',
        })
      );

      expect(failure.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('reports CHANNEL_NOT_FOUND if the user has no channel', async () => {
      await seedChannellessUser();

      const failure = expectErr(
        await channelService.getAccount({ id: CHANNELLESS_USER_ID, role: 'USER' })
      );

      expect(failure.code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('updateChannel', () => {
    it('updates channel metadata successfully', async () => {
      const updated = expectOk(
        await channelService.updateChannel(USER_ID, {
          displayName: 'Updated Name',
          handle: 'new_handle',
          bio: 'Updated bio',
        })
      );

      expect(updated.displayName).toBe('Updated Name');
      expect(updated.handle).toBe('new_handle');
      expect(updated.bio).toBe('Updated bio');
    });

    it.each([
      { name: 'a malformed handle', handle: 'ab', code: ErrorCodes.INVALID_HANDLE_FORMAT },
      { name: 'a reserved handle', handle: 'admin', code: ErrorCodes.HANDLE_ALREADY_TAKEN },
    ])('rejects $name with $code', async ({ handle, code }) => {
      const failure = expectErr(await channelService.updateChannel(USER_ID, { handle }));

      expect(failure.code).toBe(code);
    });

    it('stores trimmed links in the order given, and an empty list clears them', async () => {
      const stored = expectOk(
        await channelService.updateChannel(USER_ID, {
          links: [
            { label: ' Shop ', url: 'https://shop.example.com' },
            { label: 'Blog', url: 'https://blog.example.com' },
          ],
        })
      );
      const cleared = expectOk(await channelService.updateChannel(USER_ID, { links: [] }));

      expect(stored.links).toEqual([
        { label: 'Shop', url: 'https://shop.example.com' },
        { label: 'Blog', url: 'https://blog.example.com' },
      ]);
      expect(cleared.links).toEqual([]);
    });

    it.each([
      {
        name: 'a sixth link',
        links: Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, url: `https://e.com/${i}` })),
      },
      { name: 'a non-https link', links: [{ label: 'Site', url: 'http://example.com' }] },
    ])('refuses $name and leaves the stored links alone', async ({ links }) => {
      expectOk(
        await channelService.updateChannel(USER_ID, {
          links: [{ label: 'Kept', url: 'https://kept.example.com' }],
        })
      );

      const failure = expectErr(await channelService.updateChannel(USER_ID, { links }));

      expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field: 'links' });
      expect(expectOk(await repositories.channels.findById(CHANNEL_ID))?.links).toEqual([
        { label: 'Kept', url: 'https://kept.example.com' },
      ]);
    });

    it('reports CHANNEL_NOT_FOUND when the user has no channel', async () => {
      await seedChannellessUser();

      const failure = expectErr(
        await channelService.updateChannel(CHANNELLESS_USER_ID, { displayName: 'Ghost' })
      );

      expect(failure.code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('getPublicChannel', () => {
    it.each([
      { name: 'handle', idOrHandle: '@creator' },
      { name: 'UUID', idOrHandle: CHANNEL_ID },
    ])('finds a public channel by $name', async ({ idOrHandle }) => {
      const channel = expectOk(await channelService.getPublicChannel(idOrHandle));

      expect(channel.id).toBe(CHANNEL_ID);
      expect(channel.handle).toBe('creator');
    });

    it('carries the links and the stats of its public videos', async () => {
      expectOk(
        await repositories.channels.update(CHANNEL_ID, {
          links: [{ label: 'Shop', url: 'https://shop.example.com' }],
        })
      );
      await repositories.videos.create({
        id: '018f0000-0000-7000-8000-0000000000b1',
        ownerId: USER_ID,
        sourceKey: 'raw/b1/source.mp4',
        visibility: 'public',
        status: 'READY',
        viewsCount: 12,
      });
      await repositories.videos.create({
        id: '018f0000-0000-7000-8000-0000000000b2',
        ownerId: USER_ID,
        sourceKey: 'raw/b2/source.mp4',
        visibility: 'private',
        status: 'READY',
        viewsCount: 90,
      });

      const channel = expectOk(await channelService.getPublicChannel('@creator'));

      expect(channel).toMatchObject({
        links: [{ label: 'Shop', url: 'https://shop.example.com' }],
        videoCount: 1,
        totalViews: 12,
      });
    });

    it('reports CHANNEL_NOT_FOUND for a non-existent channel', async () => {
      const failure = expectErr(await channelService.getPublicChannel('nonexistent'));

      expect(failure.code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });
});
