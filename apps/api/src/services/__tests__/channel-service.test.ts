import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelService } from '../channel-service';

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
    channelService = new ChannelService({
      users: repositories.users,
      channels: repositories.channels,
    });

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
      const account = expectOk(await channelService.getAccount(USER_ID));

      expect(account.id).toBe(USER_ID);
      expect(account.email).toBe('creator@example.com');
      expect(account.tier).toBe('pro');
      expect(account.channel.handle).toBe('creator');
      expect(account.channel.displayName).toBe('Awesome Creator');
      expect(account.channel.subscriberCount).toBe(42);
    });

    it('reports UNAUTHORIZED if the user does not exist', async () => {
      const failure = expectErr(
        await channelService.getAccount('00000000-0000-7000-8000-000000000999')
      );

      expect(failure.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('reports CHANNEL_NOT_FOUND if the user has no channel', async () => {
      await seedChannellessUser();

      const failure = expectErr(await channelService.getAccount(CHANNELLESS_USER_ID));

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

    it('reports CHANNEL_NOT_FOUND for a non-existent channel', async () => {
      const failure = expectErr(await channelService.getPublicChannel('nonexistent'));

      expect(failure.code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('ensureProvisioned', () => {
    const NEW_USER_ID = '018f0000-0000-7000-8000-0000000000aa';

    it('creates the user and channel a first authenticated request implies', async () => {
      expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com'));

      expect(expectOk(await repositories.users.findById(NEW_USER_ID))).toMatchObject({
        email: 'ada@example.com',
        tier: 'free',
      });
      expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toMatchObject({
        handle: 'ada',
        displayName: 'ada',
      });
    });

    it('synthesises an email when the identity carries none', async () => {
      expectOk(await channelService.ensureProvisioned(NEW_USER_ID));

      expect(expectOk(await repositories.users.findById(NEW_USER_ID))).toMatchObject({
        email: `${NEW_USER_ID}@taitube.local`,
      });
      expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toMatchObject({
        displayName: 'User',
      });
    });

    it('is a no-op for an identity that already has a channel', async () => {
      expectOk(await channelService.ensureProvisioned(USER_ID, 'creator@example.com'));

      expect(expectOk(await repositories.channels.findByUserId(USER_ID))).toMatchObject({
        id: CHANNEL_ID,
        handle: 'creator',
      });
    });

    it('steps past a handle another channel already holds', async () => {
      expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'creator@example.com'));

      const channel = expectOk(await repositories.channels.findByUserId(NEW_USER_ID));

      expect(channel?.handle).not.toBe('creator');
      expect(channel?.handle).toMatch(/^creator_/);
    });

    it('never claims a reserved handle', async () => {
      expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'admin@example.com'));

      expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toMatchObject({
        handle: 'u_admin',
      });
    });

    it('surfaces a dead store rather than leaving the caller without a channel', async () => {
      const broken = new ChannelService({
        users: repositories.users,
        channels: Object.assign(Object.create(repositories.channels), {
          findByUserId: async () => err(databaseUnavailable('findByUserId')),
        }),
      });

      const provisioned = await broken.ensureProvisioned(NEW_USER_ID, 'ada@example.com');

      expect(expectErr(provisioned).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
      expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toBeNull();
    });
  });
});
