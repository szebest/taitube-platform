import { type Accounts, NO_ACCOUNTS, withSignedIn } from '../accounts';
import { setIdentityAccent, setPinnedIdentities } from '../identity-settings-functions';
import { inRequest } from './in-request';

const ACCOUNTS = [0, 1, 2].reduce<Accounts>(
  (accounts, slot) =>
    withSignedIn(accounts, {
      slot,
      userId: `user-${slot}`,
      label: `Account ${slot}`,
      avatarUrl: null,
    }),
  NO_ACCOUNTS
);

const THREE_SLOTS = `vp.session.0=a; vp.session.1=b; vp.session.2=c; vp.accounts=${encodeURIComponent(
  JSON.stringify(ACCOUNTS)
)}`;

function accountsWritten(setCookies: string[]): Accounts {
  const written = setCookies.find((set) => set.startsWith('vp.accounts='))?.split(';')[0] ?? '';
  return JSON.parse(decodeURIComponent(written.slice('vp.accounts='.length)));
}

describe('@vp/queries: identity settings server functions', () => {
  it('keeps the accent picked for an identity and the pinned order in the slot list', async () => {
    const accent = await inRequest(
      () => setIdentityAccent({ data: { slot: 1, channel: 'second', accent: 4 } }),
      { cookie: THREE_SLOTS }
    );
    const pinned = await inRequest(
      () =>
        setPinnedIdentities({ data: { pinned: [{ slot: 2 }, { slot: 1, channel: 'second' }] } }),
      { cookie: THREE_SLOTS }
    );

    expect(accountsWritten(accent.setCookies).accents).toEqual({ '1.second': 4 });
    expect(accountsWritten(pinned.setCookies).pinned).toEqual(['2.primary', '1.second']);
  });
});
