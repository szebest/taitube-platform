import { getAccount } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  LOCAL_API_BASE_URL,
  account,
  apiServer,
  mockEndpoint,
  problemReply,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { createAppApiClient } from '../api-client';
import { createQueryClient } from '../create-query-client';
import { GUEST, type Session, ensureSession, viewerOf } from '../session';
import { inRequest } from './in-request';

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

function loadSession(cookie: string, queryClient = createQueryClient()) {
  const api = createAppApiClient({ apiBaseUrl: LOCAL_API_BASE_URL, onUnauthorized: vi.fn() });
  return inRequest(() => ensureSession({ queryClient, api }), { cookie });
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

  it('signs out a viewer whose token the API refuses', async () => {
    answerAccount(() => problemReply(ErrorCodes.UNAUTHORIZED));

    const { value, setCookies } = await loadSession('vp.session=expired');

    expect(value).toEqual(GUEST);
    expect(setCookies).toEqual([expect.stringMatching(/^vp\.session=; Max-Age=0;/)]);
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
