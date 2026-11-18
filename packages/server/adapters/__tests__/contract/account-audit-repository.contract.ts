import type { AccountAuditRepositoryPort } from '@vp/core/repositories';
import type { NewAccountAuditEntry } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwnerAccounts } from './fixtures';
import { walkByCreatedAt } from './keyset-walk';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const signIn = (userId: string, slot: number | null): NewAccountAuditEntry => ({
  userId,
  action: 'account.signed_in',
  meta: { slot, userAgent: 'Firefox' },
});

export function describeAccountAuditRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('AccountAuditRepository contract', () => {
    let subject: RepositoriesSubject;
    let audit: AccountAuditRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwnerAccounts(subject.repositories);
      audit = subject.repositories.accountAudit;
    });

    it('appends a row with an id and a time, and reads it back as written', async () => {
      const written = expectOk(await audit.append(signIn(OWNER_ID, 2)));

      expect(written).toMatchObject(signIn(OWNER_ID, 2));
      expect(expectOk(await audit.list(OWNER_ID, { cursor: null, limit: 10 }))).toEqual([written]);
    });

    it("walks one user's rows newest first, a page at a time, and never another user's", async () => {
      const appended = [];
      for (const slot of [0, 1, 2])
        appended.push(expectOk(await audit.append(signIn(OWNER_ID, slot))));
      expectOk(await audit.append(signIn(OTHER_OWNER_ID, 0)));

      const served = await walkByCreatedAt(async (cursor) =>
        expectOk(await audit.list(OWNER_ID, { cursor, limit: 1 }))
      );

      expect(served).toEqual(appended.map(({ id }) => id).reverse());
    });
  });
}
