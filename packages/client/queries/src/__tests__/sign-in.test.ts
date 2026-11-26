import { getAccount, recordMySignIn } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { account, apiServer, mockEndpoint, problemReply, signInRecord } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { type Accounts, NO_ACCOUNTS, withExpired, withSignedIn } from '../accounts';
import { requestSession } from '../session-config';
import { type SignInTarget, completeSignIn } from '../sign-in';
import { inRequest } from './in-request';

vi.mock(import('../session-config'), async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, requestSession: vi.fn(original.requestSession) };
});

const NONCE = 'vp.add-nonce=n0nce';
const ADD: SignInTarget = { mode: 'add', state: 'n0nce' };

type Recorded = { body: unknown; authorization: string | null; forwardedFor: string | null };

function api({ userId = account().user.id, record = (): Response | undefined => undefined } = {}) {
  const recorded: Recorded[] = [];
  apiServer.use(
    mockEndpoint(getAccount, () =>
      HttpResponse.json(account({ user: { ...account().user, id: userId } }))
    ),
    mockEndpoint(recordMySignIn, async ({ request }) => {
      recorded.push({
        body: await request.json(),
        authorization: request.headers.get('authorization'),
        forwardedFor: request.headers.get('x-forwarded-for'),
      });
      return record() ?? HttpResponse.json(signInRecord(), { status: 201 });
    })
  );
  return recorded;
}

function accountsCookie(accounts: Accounts): string {
  return `vp.accounts=${encodeURIComponent(JSON.stringify(accounts))}`;
}

const issue = vi.fn(async (grant: string) => `new-token-of-${grant}`);

function signIn(target: SignInTarget, cookie: string) {
  return inRequest(() => completeSignIn(issue, 'creator', target), {
    cookie: `${cookie}; ${NONCE}`,
  });
}

const sessionCookies = (setCookies: string[]) =>
  setCookies.filter((set) => set.startsWith('vp.session.'));

describe('@vp/queries: sign-in', () => {
  it('adds a new token into the first free slot, records it as added, and lists the account', async () => {
    const recorded = api();

    const { value, setCookies } = await signIn(ADD, 'vp.session.0=first');

    expect(value).toEqual({ kind: 'signed-in', slot: 1, accounts: 2 });
    expect(sessionCookies(setCookies)).toEqual([
      'vp.session.1=new-token-of-creator; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax',
    ]);
    expect(recorded).toEqual([
      {
        body: { slot: 1, added: true },
        authorization: 'Bearer new-token-of-creator',
        forwardedFor: null,
      },
    ]);
    const listed = setCookies.find((set) => set.startsWith('vp.accounts=')) ?? '';
    expect(decodeURIComponent(listed)).toContain('"slot":1');
    expect(listed).not.toContain('HttpOnly');
  });

  it('never signs in with a token the request carries, only the one it was issued', async () => {
    const recorded = api();

    const { setCookies } = await inRequest(() => completeSignIn(issue, 'creator', ADD), {
      cookie: `${NONCE}; vp.session.0=first; vp.session.1=forged`,
    });

    expect(recorded[0]?.authorization).toBe('Bearer new-token-of-creator');
    expect(sessionCookies(setCookies)[0]).toMatch(/^vp\.session\.2=new-token-of-creator;/);
  });

  it('ends on the slot a user already holds, so one user never holds two', async () => {
    const recorded = api();
    const held = withSignedIn(NO_ACCOUNTS, {
      slot: 3,
      userId: account().user.id,
      label: 'Me',
      avatarUrl: null,
    });

    const { value, setCookies } = await signIn(
      ADD,
      `vp.session.0=other; vp.session.3=mine; ${accountsCookie(held)}`
    );

    expect(value).toEqual({ kind: 'already-signed-in', slot: 3, accounts: 2 });
    expect(sessionCookies(setCookies)[0]).toMatch(/^vp\.session\.3=new-token-of-creator;/);
    expect(recorded[0]?.body).toEqual({ slot: 3, added: false });
  });

  it('signs a user whose slot expired back into that slot, as a sign-in rather than an add', async () => {
    const recorded = api();
    const expired = withExpired(
      withSignedIn(NO_ACCOUNTS, {
        slot: 2,
        userId: account().user.id,
        label: 'Me',
        avatarUrl: null,
      }),
      2
    );

    const { value, setCookies } = await signIn(
      ADD,
      `vp.session.0=other; ${accountsCookie(expired)}`
    );

    expect(value).toEqual({ kind: 'signed-in', slot: 2, accounts: 2 });
    expect(sessionCookies(setCookies)[0]).toMatch(/^vp\.session\.2=new-token-of-creator;/);
    expect(recorded[0]?.body).toEqual({ slot: 2, added: false });
  });

  it.each([
    { target: ADD, held: 10 },
    { target: { mode: 'slot', slot: 9 } as const, held: 9 },
  ])(
    'refuses a session past ACCOUNTS_MAX into $target.mode, and writes nothing',
    async ({ target, held }) => {
      api();
      vi.mocked(requestSession).mockReturnValue({
        apiBaseUrl: undefined,
        cookieDomain: undefined,
        devTokenUrl: undefined,
        accountsMax: held,
      });
      const full = Array.from({ length: held }, (_, slot) => `vp.session.${slot}=t${slot}`);

      const { value, setCookies } = await inRequest(
        () => completeSignIn(issue, 'creator', target),
        { cookie: [...full, NONCE].join('; ') }
      );

      expect(value).toEqual({ kind: 'accounts-full' });
      expect(sessionCookies(setCookies)).toEqual([]);
    }
  );

  it('refuses an add the API rate-limited, and writes nothing', async () => {
    api({ record: () => problemReply(ErrorCodes.RATE_LIMITED) });

    const { value, setCookies } = await signIn(ADD, 'vp.session.0=first');

    expect(value).toEqual({ kind: 'rate-limited' });
    expect(sessionCookies(setCookies)).toEqual([]);
  });

  it.each([
    { scenario: 'a state this browser did not start', cookie: 'vp.add-nonce=other' },
    { scenario: 'no add started at all', cookie: '' },
  ])('refuses $scenario before any token is issued', async ({ cookie }) => {
    issue.mockClear();

    const { value } = await inRequest(() => completeSignIn(issue, 'creator', ADD), { cookie });

    expect(value).toEqual({ kind: 'refused' });
    expect(issue).not.toHaveBeenCalled();
  });

  it('refuses a slot that holds another user live session, and writes nothing', async () => {
    const recorded = api();

    const { value, setCookies } = await signIn({ mode: 'slot', slot: 2 }, 'vp.session.2=someone');

    expect(value).toEqual({ kind: 'slot-taken' });
    expect(sessionCookies(setCookies)).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it('signs a first account into one slot, as a sign-in rather than an add', async () => {
    const recorded = api();

    const { value, setCookies } = await signIn({ mode: 'slot', slot: 2 }, '');

    expect(value).toEqual({ kind: 'signed-in', slot: 2, accounts: 1 });
    expect(sessionCookies(setCookies)[0]).toMatch(/^vp\.session\.2=/);
    expect(recorded[0]?.body).toEqual({ slot: 2, added: false });
  });

  it('signs a new user into one slot beside another as an add, bound to its nonce and counted', async () => {
    const recorded = api();

    const { value, setCookies } = await signIn(
      { mode: 'slot', slot: 2, state: 'n0nce' },
      'vp.session.0=first'
    );

    expect(value).toEqual({ kind: 'signed-in', slot: 2, accounts: 2 });
    expect(sessionCookies(setCookies)[0]).toMatch(/^vp\.session\.2=/);
    expect(recorded[0]?.body).toEqual({ slot: 2, added: true });
  });

  it.each([
    { scenario: 'no nonce', target: { mode: 'slot', slot: 2 } as const },
    {
      scenario: 'a nonce this browser did not start',
      target: { mode: 'slot', slot: 2, state: 'other' } as const,
    },
  ])(
    'refuses a new user into one slot beside another with $scenario, and writes nothing',
    async ({ target }) => {
      const recorded = api();

      const { value, setCookies } = await signIn(target, 'vp.session.0=first');

      expect(value).toEqual({ kind: 'refused' });
      expect(sessionCookies(setCookies)).toEqual([]);
      expect(recorded).toEqual([]);
    }
  );
});
