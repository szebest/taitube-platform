import type { UserRepository } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
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

    it('answers ok(null) for an unknown user, because absence is not a failure', async () => {
      expect(expectOk(await users.findById(OWNER_ID))).toBeNull();
    });

    it('inserts on the first upsert and reads back the defaults', async () => {
      const created = expectOk(
        await users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' })
      );

      expect(created).toMatchObject({ id: OWNER_ID, tier: 'free', role: 'USER' });
      expect(expectOk(await users.findById(OWNER_ID))).toMatchObject({
        email: 'owner@video-pipeline.local',
      });
    });

    it('updates in place on a second upsert of the same id', async () => {
      expectOk(await users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' }));
      const updated = expectOk(
        await users.upsert({
          id: OWNER_ID,
          email: 'renamed@video-pipeline.local',
          tier: 'pro',
          role: 'CREATOR',
        })
      );

      expect(updated).toMatchObject({
        email: 'renamed@video-pipeline.local',
        tier: 'pro',
        role: 'CREATOR',
      });
      expect(expectOk(await users.findById(OWNER_ID))?.email).toBe('renamed@video-pipeline.local');
    });
  });
}
