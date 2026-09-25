import { ErrorCodes } from '@vp/errors';
import { expectErr } from '@vp/testing/result';
import { inMemoryMultipartStorageSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeMultipartStorageContract } from '../../__tests__/contract/multipart-storage.contract';
import { InMemoryMultipartStorage } from '../in-memory-multipart-storage';

describeMultipartStorageContract(inMemoryMultipartStorageSubject);

describe('InMemoryMultipartStorage', () => {
  it('refuses a part for an upload it never opened', () => {
    const multipart = new InMemoryMultipartStorage();

    const refused = expectErr(multipart.seedPart('upload-absent', 1, Buffer.from('x')));

    expect(refused.code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
  });
});
