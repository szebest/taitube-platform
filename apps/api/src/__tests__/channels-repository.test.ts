import { InMemoryChannelRepository } from '@vp/adapters';
import { isReservedHandle, isValidHandleFormat, normalizeHandle } from '@vp/validation';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Channel Domain & InMemoryChannelRepository', () => {
  let channelRepo: InMemoryChannelRepository;

  beforeEach(() => {
    channelRepo = new InMemoryChannelRepository();
  });

  describe('Handle Validation & Sanitization', () => {
    it('validates handle format (^[a-zA-Z0-9_.-]{3,30}$)', () => {
      expect(isValidHandleFormat('johndoe')).toBe(true);
      expect(isValidHandleFormat('john_doe-123.tv')).toBe(true);
      expect(isValidHandleFormat('ab')).toBe(false); // too short
      expect(isValidHandleFormat('a'.repeat(31))).toBe(false); // too long
      expect(isValidHandleFormat('john doe')).toBe(false); // spaces
      expect(isValidHandleFormat('john@doe')).toBe(false); // special char
    });

    it('identifies reserved handles', () => {
      expect(isReservedHandle('admin')).toBe(true);
      expect(isReservedHandle('ADMIN')).toBe(true);
      expect(isReservedHandle('api')).toBe(true);
      expect(isReservedHandle('studio')).toBe(true);
      expect(isReservedHandle('feed')).toBe(true);
      expect(isReservedHandle('regularuser')).toBe(false);
    });

    it('normalizes handles with @ prefix and uppercase characters', () => {
      expect(normalizeHandle('@JohnDoe')).toBe('johndoe');
      expect(normalizeHandle('Creator_01 ')).toBe('creator_01');
    });
  });

  describe('InMemoryChannelRepository CRUD', () => {
    it('seeds dev channels for dev users', async () => {
      const devChannel = await channelRepo.findByUserId('00000000-0000-7000-8000-000000000001');
      expect(devChannel).not.toBeNull();
      expect(devChannel?.handle).toBe('dev');
      expect(devChannel?.displayName).toBe('Dev Channel');
    });

    it('creates a new channel successfully', async () => {
      const created = await channelRepo.create({
        userId: '11111111-1111-7000-8000-000000000001',
        handle: 'CoolCreator',
        displayName: 'Cool Creator',
        bio: 'Awesome content',
      });

      expect(created.id).toBeDefined();
      expect(created.handle).toBe('coolcreator'); // lowercased
      expect(created.displayName).toBe('Cool Creator');
      expect(created.subscriberCount).toBe(0);
      expect(created.bio).toBe('Awesome content');
    });

    it('rejects duplicate handles with HANDLE_ALREADY_TAKEN regardless of case', async () => {
      await channelRepo.create({
        userId: '11111111-1111-7000-8000-000000000001',
        handle: 'uniquehandle',
        displayName: 'User 1',
      });

      await expect(
        channelRepo.create({
          userId: '22222222-2222-7000-8000-000000000002',
          handle: 'UNIQUEHANDLE',
          displayName: 'User 2',
        })
      ).rejects.toThrowError(PermanentError);

      try {
        await channelRepo.create({
          userId: '22222222-2222-7000-8000-000000000002',
          handle: 'UNIQUEHANDLE',
          displayName: 'User 2',
        });
      } catch (err) {
        expect((err as PermanentError).code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
      }
    });

    it('finds by ID, user ID, and handle case-insensitively', async () => {
      const created = await channelRepo.create({
        userId: '11111111-1111-7000-8000-000000000001',
        handle: 'myhandle',
        displayName: 'My Handle',
      });

      expect(await channelRepo.findById(created.id)).toEqual(created);
      expect(await channelRepo.findByUserId('11111111-1111-7000-8000-000000000001')).toEqual(
        created
      );
      expect(await channelRepo.findByHandle('MYHANDLE')).toEqual(created);
      expect(await channelRepo.findByHandle('myhandle')).toEqual(created);
      expect(await channelRepo.findByHandle('nonexistent')).toBeNull();
    });

    it('updates channel fields and rejects handle conflicts', async () => {
      const ch1 = await channelRepo.create({
        userId: '11111111-1111-7000-8000-000000000001',
        handle: 'channelone',
        displayName: 'Channel One',
      });
      await channelRepo.create({
        userId: '22222222-2222-7000-8000-000000000002',
        handle: 'channeltwo',
        displayName: 'Channel Two',
      });

      const updated = await channelRepo.update(ch1.id, {
        displayName: 'New Channel One Name',
        bio: 'Updated bio',
      });
      expect(updated.displayName).toBe('New Channel One Name');
      expect(updated.bio).toBe('Updated bio');

      // Attempt conflict with ch2 handle
      await expect(channelRepo.update(ch1.id, { handle: 'channeltwo' })).rejects.toThrowError(
        PermanentError
      );

      // Updating non-existent channel throws CHANNEL_NOT_FOUND
      await expect(
        channelRepo.update('non-existent-id', { displayName: 'Ghost' })
      ).rejects.toThrowError(PermanentError);
    });

    it('resets to seeded channels on clear()', async () => {
      await channelRepo.create({
        userId: '11111111-1111-7000-8000-000000000001',
        handle: 'temporary',
        displayName: 'Temporary',
      });

      expect(await channelRepo.findByHandle('temporary')).not.toBeNull();
      channelRepo.clear();
      expect(await channelRepo.findByHandle('temporary')).toBeNull();
      expect(await channelRepo.findByHandle('dev')).not.toBeNull();
    });
  });
});
