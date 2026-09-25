import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeUserRepositoryContract } from '../../../__tests__/contract/user-repository.contract';
import { InMemoryUserRepository } from '../in-memory-user-repository';

describeUserRepositoryContract(inMemorySubject);

describe('InMemoryUserRepository dev seed', () => {
  it('holds the seeded creator and user from construction and restores them on clear', async () => {
    const users = new InMemoryUserRepository();
    expectOk(await users.upsert({ id: SEEDED.userId, email: 'renamed@video-pipeline.local' }));

    users.clear();

    expect(expectOk(await users.findById(SEEDED.userId))).toMatchObject({
      email: 'dev@video-pipeline.local',
      role: 'CREATOR',
    });
    expect(expectOk(await users.findById(SEEDED.otherUserId))).toMatchObject({ role: 'USER' });
  });
});
