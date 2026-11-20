import { expectOk } from '@kit/testing/result';
import { inMemorySubject } from '../../../__tests__/contract/subjects';
import { describeVideoPasswordRepositoryContract } from '../../../__tests__/contract/video-password-repository.contract';
import { InMemoryVideoPasswordRepository } from '../in-memory-video-password-repository';

describeVideoPasswordRepositoryContract(inMemorySubject);

describe('InMemoryVideoPasswordRepository', () => {
  it('clears the hashes it holds', async () => {
    const passwords = new InMemoryVideoPasswordRepository({ setPasswordProtected: () => true });
    expectOk(await passwords.setHash('video-1', 'hash'));

    passwords.clear();

    expect(expectOk(await passwords.hashOf('video-1'))).toBeNull();
  });

  it('leaves the hash out when the video record is not there', async () => {
    const passwords = new InMemoryVideoPasswordRepository({ setPasswordProtected: () => false });

    expect(expectOk(await passwords.setHash('video-1', 'hash'))).toBe(false);
    expect(expectOk(await passwords.hashOf('video-1'))).toBeNull();
  });
});
