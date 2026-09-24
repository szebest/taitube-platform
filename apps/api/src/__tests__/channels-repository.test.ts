import { InMemoryChannelRepository } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';

describe('apps/api: channel repository', () => {
  let channelRepo: InMemoryChannelRepository;

  const USER_ONE = '11111111-1111-7000-8000-000000000001';
  const USER_TWO = '22222222-2222-7000-8000-000000000002';

  beforeEach(() => {
    channelRepo = new InMemoryChannelRepository();
  });

  describe('InMemoryChannelRepository CRUD', () => {
    it('seeds dev channels for dev users', async () => {
      const devChannel = expectOk(
        await channelRepo.findByUserId('00000000-0000-7000-8000-000000000001')
      );

      expect(devChannel).not.toBeNull();
      expect(devChannel?.handle).toBe('dev');
      expect(devChannel?.displayName).toBe('Dev Channel');
    });

    it('creates a new channel successfully', async () => {
      const created = expectOk(
        await channelRepo.create({
          userId: USER_ONE,
          handle: 'CoolCreator',
          displayName: 'Cool Creator',
          bio: 'Awesome content',
        })
      );

      expect(created.id).toBeDefined();
      expect(created.handle).toBe('coolcreator');
      expect(created.displayName).toBe('Cool Creator');
      expect(created.subscriberCount).toBe(0);
      expect(created.bio).toBe('Awesome content');
    });

    it('reports HANDLE_ALREADY_TAKEN on create regardless of case', async () => {
      expectOk(
        await channelRepo.create({
          userId: USER_ONE,
          handle: 'uniquehandle',
          displayName: 'User 1',
        })
      );

      const failure = expectErr(
        await channelRepo.create({
          userId: USER_TWO,
          handle: 'UNIQUEHANDLE',
          displayName: 'User 2',
        })
      );

      expect(failure.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('finds by ID, user ID, and handle case-insensitively', async () => {
      const created = expectOk(
        await channelRepo.create({
          userId: USER_ONE,
          handle: 'myhandle',
          displayName: 'My Handle',
        })
      );

      expect(expectOk(await channelRepo.findById(created.id))).toEqual(created);
      expect(expectOk(await channelRepo.findByUserId(USER_ONE))).toEqual(created);
      expect(expectOk(await channelRepo.findByHandle('MYHANDLE'))).toEqual(created);
      expect(expectOk(await channelRepo.findByHandle('myhandle'))).toEqual(created);
      expect(expectOk(await channelRepo.findByHandle('nonexistent'))).toBeNull();
    });

    it('updates channel fields', async () => {
      const channel = expectOk(
        await channelRepo.create({
          userId: USER_ONE,
          handle: 'channelone',
          displayName: 'Channel One',
        })
      );

      const updated = expectOk(
        await channelRepo.update(channel.id, {
          displayName: 'New Channel One Name',
          bio: 'Updated bio',
        })
      );

      expect(updated?.displayName).toBe('New Channel One Name');
      expect(updated?.bio).toBe('Updated bio');
    });

    it('reports HANDLE_ALREADY_TAKEN on update when another channel holds the handle', async () => {
      const channel = expectOk(
        await channelRepo.create({
          userId: USER_ONE,
          handle: 'channelone',
          displayName: 'Channel One',
        })
      );
      expectOk(
        await channelRepo.create({
          userId: USER_TWO,
          handle: 'channeltwo',
          displayName: 'Channel Two',
        })
      );

      const failure = expectErr(await channelRepo.update(channel.id, { handle: 'channeltwo' }));

      expect(failure.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('answers null when updating a channel that is not there', async () => {
      const updated = expectOk(
        await channelRepo.update('non-existent-id', { displayName: 'Ghost' })
      );

      expect(updated).toBeNull();
    });

    it('resets to seeded channels on clear()', async () => {
      expectOk(
        await channelRepo.create({
          userId: USER_ONE,
          handle: 'temporary',
          displayName: 'Temporary',
        })
      );

      expect(expectOk(await channelRepo.findByHandle('temporary'))).not.toBeNull();
      channelRepo.clear();
      expect(expectOk(await channelRepo.findByHandle('temporary'))).toBeNull();
      expect(expectOk(await channelRepo.findByHandle('dev'))).not.toBeNull();
    });
  });
});
