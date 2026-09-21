import type { UserRepository } from '@vp/core/ports';
import { OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeUserRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('UserRepository contract', () => {
    let subject: RepositoriesSubject;
    let users: UserRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      users = subject.repositories.users;
    });

    it('returns null for an unknown user', async () => {
      expect(await users.findById(OWNER_ID)).toBeNull();
    });

    it('inserts on the first upsert and reads back the defaults', async () => {
      const created = await users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' });

      expect(created.id).toBe(OWNER_ID);
      expect(created.tier).toBe('free');
      expect(created.role).toBe('USER');
      expect(await users.findById(OWNER_ID)).toMatchObject({
        email: 'owner@video-pipeline.local',
      });
    });

    it('updates in place on a second upsert of the same id', async () => {
      await users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' });
      const updated = await users.upsert({
        id: OWNER_ID,
        email: 'renamed@video-pipeline.local',
        tier: 'pro',
        role: 'CREATOR',
      });

      expect(updated.email).toBe('renamed@video-pipeline.local');
      expect(updated.tier).toBe('pro');
      expect(updated.role).toBe('CREATOR');
      expect((await users.findById(OWNER_ID))?.email).toBe('renamed@video-pipeline.local');
    });
  });
}
