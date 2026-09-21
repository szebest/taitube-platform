import { InMemoryRepositories } from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import { ChannelService } from '../channel-service';

describe('ChannelService', () => {
  let repositories: InMemoryRepositories;
  let channelService: ChannelService;

  const USER_ID = '018f0000-0000-7000-8000-000000000001';
  const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    channelService = new ChannelService({
      users: repositories.users,
      channels: repositories.channels,
    });

    await repositories.users.upsert({
      id: USER_ID,
      email: 'creator@example.com',
      tier: 'pro',
    });

    await repositories.channels.create({
      id: CHANNEL_ID,
      userId: USER_ID,
      handle: 'creator',
      displayName: 'Awesome Creator',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      bannerUrl: 'https://cdn.example.com/banner.png',
      bio: 'Hello world!',
      subscriberCount: 42,
    });
  });

  describe('getAccount', () => {
    it('returns user account and associated channel details', async () => {
      const account = await channelService.getAccount(USER_ID);

      expect(account.id).toBe(USER_ID);
      expect(account.email).toBe('creator@example.com');
      expect(account.tier).toBe('pro');
      expect(account.channel.handle).toBe('creator');
      expect(account.channel.displayName).toBe('Awesome Creator');
      expect(account.channel.subscriberCount).toBe(42);
    });

    it('throws UNAUTHORIZED if user does not exist', async () => {
      await expect(
        channelService.getAccount('00000000-0000-7000-8000-000000000999')
      ).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.UNAUTHORIZED,
        })
      );
    });

    it('throws CHANNEL_NOT_FOUND if user has no channel', async () => {
      const otherUserId = '018f0000-0000-7000-8000-000000000003';
      await repositories.users.upsert({
        id: otherUserId,
        email: 'nochannel@example.com',
        tier: 'free',
      });

      await expect(channelService.getAccount(otherUserId)).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.CHANNEL_NOT_FOUND,
        })
      );
    });
  });

  describe('updateChannel', () => {
    it('updates channel metadata successfully', async () => {
      const updated = await channelService.updateChannel(USER_ID, {
        displayName: 'Updated Name',
        handle: 'new_handle',
        bio: 'Updated bio',
      });

      expect(updated.displayName).toBe('Updated Name');
      expect(updated.handle).toBe('new_handle');
      expect(updated.bio).toBe('Updated bio');
    });

    it('rejects invalid handle format', async () => {
      await expect(channelService.updateChannel(USER_ID, { handle: 'ab' })).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.INVALID_HANDLE_FORMAT,
        })
      );
    });

    it('rejects reserved handles', async () => {
      await expect(channelService.updateChannel(USER_ID, { handle: 'admin' })).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.HANDLE_ALREADY_TAKEN,
        })
      );
    });
  });

  describe('getPublicChannel', () => {
    it('finds public channel by handle', async () => {
      const channel = await channelService.getPublicChannel('@creator');
      expect(channel.id).toBe(CHANNEL_ID);
      expect(channel.handle).toBe('creator');
    });

    it('finds public channel by UUID', async () => {
      const channel = await channelService.getPublicChannel(CHANNEL_ID);
      expect(channel.id).toBe(CHANNEL_ID);
      expect(channel.handle).toBe('creator');
    });

    it('throws CHANNEL_NOT_FOUND for non-existent channel', async () => {
      await expect(channelService.getPublicChannel('nonexistent')).rejects.toThrowError(
        expect.objectContaining({
          code: ErrorCodes.CHANNEL_NOT_FOUND,
        })
      );
    });
  });

  describe('ensureProvisioned', () => {
    const NEW_USER_ID = '018f0000-0000-7000-8000-0000000000aa';

    it('creates the user and channel a first authenticated request implies', async () => {
      await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com');

      await expect(repositories.users.findById(NEW_USER_ID)).resolves.toMatchObject({
        email: 'ada@example.com',
        tier: 'free',
      });
      await expect(repositories.channels.findByUserId(NEW_USER_ID)).resolves.toMatchObject({
        handle: 'ada',
        displayName: 'ada',
      });
    });

    it('synthesises an email when the identity carries none', async () => {
      await channelService.ensureProvisioned(NEW_USER_ID);

      await expect(repositories.users.findById(NEW_USER_ID)).resolves.toMatchObject({
        email: `${NEW_USER_ID}@taitube.local`,
      });
      await expect(repositories.channels.findByUserId(NEW_USER_ID)).resolves.toMatchObject({
        displayName: 'User',
      });
    });

    it('is a no-op for an identity that already has a channel', async () => {
      await channelService.ensureProvisioned(USER_ID, 'creator@example.com');

      await expect(repositories.channels.findByUserId(USER_ID)).resolves.toMatchObject({
        id: CHANNEL_ID,
        handle: 'creator',
      });
    });

    it('steps past a handle another channel already holds', async () => {
      await channelService.ensureProvisioned(NEW_USER_ID, 'creator@example.com');

      const channel = await repositories.channels.findByUserId(NEW_USER_ID);
      expect(channel?.handle).not.toBe('creator');
      expect(channel?.handle).toMatch(/^creator_/);
    });

    it('never claims a reserved handle', async () => {
      await channelService.ensureProvisioned(NEW_USER_ID, 'admin@example.com');

      await expect(repositories.channels.findByUserId(NEW_USER_ID)).resolves.toMatchObject({
        handle: 'u_admin',
      });
    });
  });
});
