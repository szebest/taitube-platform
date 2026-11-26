import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { AccountSecurityService } from '../account-security-service';

const USER = { id: '00000000-0000-7000-8000-0000000000a1', role: 'USER' } as const;

describe('AccountSecurityService', () => {
  let repositories: InMemoryRepositories;
  let service: AccountSecurityService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new AccountSecurityService({
      audit: repositories.accountAudit,
      paginator: new Paginator(),
    });
  });

  it('answers each sign-in with its slot and user agent, newest first', async () => {
    for (const slot of [0, 3]) {
      expectOk(
        await repositories.accountAudit.append({
          userId: USER.id,
          action: 'account.signed_in',
          meta: { slot, userAgent: 'Firefox' },
        })
      );
    }

    const page = expectOk(await service.signIns(USER, {}));

    expect(page).toMatchObject({
      items: [
        { action: 'account.signed_in', slot: 3, userAgent: 'Firefox' },
        { action: 'account.signed_in', slot: 0, userAgent: 'Firefox' },
      ],
      nextCursor: null,
    });
  });

  it('records a sign-in into a slot as the caller own row, with the user agent cut short', async () => {
    const recorded = expectOk(
      await service.recordSignIn(USER, { slot: 4, userAgent: 'x'.repeat(500) })
    );

    expect(recorded).toMatchObject({ action: 'account.signed_in', slot: 4 });
    expect(recorded.userAgent).toHaveLength(200);
    expect(expectOk(await service.signIns(USER, {})).items).toEqual([recorded]);
  });

  it('refuses a cursor it did not mint', async () => {
    expect(expectErr(await service.signIns(USER, { cursor: 'nonsense' })).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
