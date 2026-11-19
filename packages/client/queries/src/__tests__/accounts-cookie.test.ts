import { NO_ACCOUNTS, withSignedIn } from '../accounts';
import { readAccounts, writeAccounts } from '../accounts-cookie';
import { inRequest } from './in-request';

const SIGNED_IN = withSignedIn(NO_ACCOUNTS, {
  slot: 1,
  userId: 'u1',
  label: 'The Creator',
  avatarUrl: null,
});

describe('@vp/queries: accounts cookie', () => {
  it('reads back the slot list it wrote, which scripts may read', async () => {
    const { setCookies } = await inRequest(() => writeAccounts(SIGNED_IN, undefined));
    const [written = ''] = setCookies;

    expect(written).not.toContain('HttpOnly');
    expect(written).toMatch(/SameSite=Lax/);
    const cookie = written.split(';')[0] ?? '';
    expect((await inRequest(readAccounts, { cookie })).value).toEqual(SIGNED_IN);
  });

  it('clears the cookie once no slot is left', async () => {
    const { setCookies } = await inRequest(() => writeAccounts(NO_ACCOUNTS, undefined));

    expect(setCookies).toEqual([expect.stringMatching(/^vp\.accounts=; Max-Age=0;/)]);
  });

  it('reads a cookie it cannot parse as no accounts', async () => {
    expect((await inRequest(readAccounts, { cookie: 'vp.accounts=%7Bnope' })).value).toEqual(
      NO_ACCOUNTS
    );
  });
});
