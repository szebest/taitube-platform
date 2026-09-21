import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000301';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-000000000302';

export function describeChannelRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelRepository contract', () => {
    let subject: RepositoriesSubject;
    let channels: ChannelRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      channels = subject.repositories.channels;
      await channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'OwnerHandle',
        displayName: 'Owner',
      });
    });

    it('stores the handle lower-cased and applies the defaults', async () => {
      expect(await channels.findById(CHANNEL_ID)).toMatchObject({
        handle: 'ownerhandle',
        displayName: 'Owner',
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        subscriberCount: 0,
      });
    });

    it('looks a channel up by id, user and handle, case-insensitively', async () => {
      expect((await channels.findByUserId(OWNER_ID))?.id).toBe(CHANNEL_ID);
      expect((await channels.findByHandle('OWNERHANDLE'))?.id).toBe(CHANNEL_ID);
      expect(await channels.findByHandle('missing-handle')).toBeNull();
      expect(await channels.findByUserId(OTHER_OWNER_ID)).toBeNull();
    });

    it('rejects a handle already taken by another channel', async () => {
      await expect(
        channels.create({
          id: OTHER_CHANNEL_ID,
          userId: OTHER_OWNER_ID,
          handle: 'ownerhandle',
          displayName: 'Impostor',
        })
      ).rejects.toThrow();
    });

    it('patches only the supplied fields', async () => {
      const updated = await channels.update(CHANNEL_ID, { displayName: 'Renamed', bio: 'Hello' });

      expect(updated.displayName).toBe('Renamed');
      expect(updated.bio).toBe('Hello');
      expect(updated.handle).toBe('ownerhandle');
    });
  });
}
