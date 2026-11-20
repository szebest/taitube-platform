import { listMyIdentities } from '@vp/api-contracts';
import { apiServer, identities, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw';
import { inRequest } from '../../__tests__/in-request';
import { type Accounts, NO_ACCOUNTS, withDefault, withSignedIn } from '../../accounts';
import { studioPathForChannel } from '../channel-identity';

const OWNER = '0190c3a0-5e1d-7000-8000-00000000b009';

const card = (handle: string) => ({
  id: crypto.randomUUID(),
  handle,
  displayName: handle,
  avatarUrl: null,
});

const SLOTS = [0, 1, 2].reduce<Accounts>(
  (accounts, slot) =>
    withSignedIn(accounts, { slot, userId: `u${slot}`, label: `A${slot}`, avatarUrl: null }),
  NO_ACCOUNTS
);

function cookie(accounts: Accounts, slots = [0, 1, 2]) {
  const sessions = slots.map((slot) => `vp.session.${slot}=token-${slot}`);
  return [...sessions, `vp.accounts=${encodeURIComponent(JSON.stringify(accounts))}`].join('; ');
}

function answer() {
  const asked: string[] = [];
  apiServer.use(
    mockEndpoint(listMyIdentities, ({ request }) => {
      const token = request.headers.get('authorization') ?? '';
      asked.push(token);
      const byToken: Record<string, ReturnType<typeof identities>> = {
        'Bearer token-1': identities({ owned: [{ ...card('engines'), isPrimary: true }] }),
        'Bearer token-2': identities({
          member: [{ ...card('engines'), role: 'editor', ownerId: OWNER }],
          owned: [{ ...card('notes'), isPrimary: false }],
        }),
      };
      return HttpResponse.json(byToken[token] ?? identities());
    })
  );
  return asked;
}

const pathFor = (handle: string, accounts: Accounts, slots?: number[]) =>
  inRequest(() => studioPathForChannel({ data: { handle, next: '/videos' } }), {
    cookie: cookie(accounts, slots),
  });

describe('@vp/queries: studio path for a channel', () => {
  it('opens as the identity the browser last used the channel as, asking nobody', async () => {
    const asked = answer();

    const { value } = await pathFor('engines', withDefault(SLOTS, 2, 'engines'));

    expect(value).toBe('/u/2/c/engines/videos');
    expect(asked).toEqual([]);
  });

  it.each([
    { handle: 'engines', path: '/u/1/videos', why: 'the first slot that owns it as its primary' },
    { handle: 'notes', path: '/u/2/c/notes/videos', why: 'a slot that owns it beside its primary' },
    { handle: 'nobody', path: undefined, why: 'no slot acting as it' },
  ])('opens $handle as $why', async ({ handle, path }) => {
    answer();

    expect((await pathFor(handle, SLOTS)).value).toBe(path);
  });

  it('drops the prefix for the primary channel of a one-account browser', async () => {
    answer();

    expect((await pathFor('engines', SLOTS, [1])).value).toBe('/videos');
  });
});
