import { getAccount, listMyIdentities } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  LOCAL_API_BASE_URL,
  account,
  apiServer,
  mockEndpoint,
  problemReply,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { Identity } from '../account-slots';
import { createAppApiClient } from '../api-client';
import { createQueryClient } from '../create-query-client';
import { createIdentityStore } from '../identity-store';
import { GUEST, type Session, ensureSession, viewerOf } from '../session';
import { inRequest } from './in-request';

const SECOND_CHANNEL = '00000000-0000-7000-8000-0000000000c2';
const MEMBER_CHANNEL = '00000000-0000-7000-8000-0000000000c3';

function answerAccount(reply: () => Response): () => number {
  let asked = 0;
  apiServer.use(
    mockEndpoint(getAccount, () => {
      asked += 1;
      return reply();
    })
  );
  return () => asked;
}

function loadSession(
  cookie: string,
  queryClient = createQueryClient(),
  identity: Identity = { slot: 0 }
) {
  const api = createAppApiClient({
    apiBaseUrl: LOCAL_API_BASE_URL,
    getSlot: () => identity.slot,
    onUnauthorized: vi.fn(),
  });
  const store = createIdentityStore({ identity, prefixed: true }, queryClient);
  return inRequest(() => ensureSession({ queryClient, api, identity: store }), { cookie });
}

describe('@vp/queries: session', () => {
  it('is a guest without a session cookie, and asks the API nothing', async () => {
    const asked = answerAccount(() => HttpResponse.json(account()));

    expect((await loadSession('vp.theme=dark')).value).toEqual(GUEST);
    expect(asked()).toBe(0);
  });

  it('is the account the session token reaches, loaded once per cache', async () => {
    const asked = answerAccount(() => HttpResponse.json(account()));
    const queryClient = createQueryClient();

    await loadSession('vp.session=t0ken', queryClient);
    const { value } = await loadSession('vp.session=t0ken', queryClient);

    expect(value).toEqual({ status: 'signed-in', account: account() });
    expect(asked()).toBe(1);
  });

  it("is the account of the identity's own slot, and a guest on a slot with none", async () => {
    answerAccount(() => HttpResponse.json(account()));
    const cookie = 'vp.session.0=first';

    expect((await loadSession(cookie, createQueryClient(), { slot: 0 })).value).toMatchObject({
      status: 'signed-in',
    });
    expect((await loadSession(cookie, createQueryClient(), { slot: 1 })).value).toEqual(GUEST);
  });

  it.each([
    { handle: 'second', actingChannelId: SECOND_CHANNEL },
    { handle: 'worked-on', actingChannelId: MEMBER_CHANNEL },
    { handle: 'strangers', actingChannelId: undefined },
  ])(
    'acts as the channel /c/$handle names: $actingChannelId',
    async ({ handle, actingChannelId }) => {
      answerAccount(() => HttpResponse.json(account()));
      const card = (id: string, cardHandle: string) => ({
        id,
        handle: cardHandle,
        displayName: cardHandle,
        avatarUrl: null,
      });
      apiServer.use(
        mockEndpoint(listMyIdentities, () =>
          HttpResponse.json({
            account: { id: account().user.id, email: account().user.email },
            owned: [{ ...card(SECOND_CHANNEL, 'second'), isPrimary: false }],
            member: [
              { ...card(MEMBER_CHANNEL, 'worked-on'), role: 'editor', ownerId: account().user.id },
            ],
          })
        )
      );

      const { value } = await loadSession('vp.session.1=t0ken', createQueryClient(), {
        slot: 1,
        channel: handle,
      });

      expect(value).toEqual({ status: 'signed-in', account: account(), actingChannelId });
    }
  );

  it('expires the one slot whose token the API refuses, and leaves the others', async () => {
    answerAccount(() => problemReply(ErrorCodes.UNAUTHORIZED));

    const { value, setCookies } = await loadSession(
      'vp.session.0=valid; vp.session.1=expired',
      createQueryClient(),
      { slot: 1 }
    );

    expect(value).toEqual(GUEST);
    expect(setCookies[0]).toMatch(/^vp\.session\.1=; Max-Age=0;/);
    expect(setCookies.join('\n')).not.toContain('vp.session.0=');
  });

  it('fails the render when the API fails, rather than signing the viewer out', async () => {
    answerAccount(() => problemReply(ErrorCodes.INTERNAL));

    await expect(loadSession('vp.session=t0ken')).rejects.toThrow();
  });

  it.each<{ session: Session; viewer: ReturnType<typeof viewerOf> }>([
    { session: GUEST, viewer: null },
    {
      session: { status: 'signed-in', account: account({ role: 'ADMIN' }) },
      viewer: { id: account().user.id, role: 'ADMIN', email: account().user.email },
    },
  ])('lets @vp/permissions decide for $session.status as $viewer', ({ session, viewer }) => {
    expect(viewerOf(session)).toEqual(viewer);
  });
});
