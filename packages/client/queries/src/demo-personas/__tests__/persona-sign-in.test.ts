import { getAccount, recordMySignIn } from '@vp/api-contracts';
import { account, apiServer, mockEndpoint, signInRecord } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { inRequest } from '../../__tests__/in-request';
import { requestSession } from '../../session-config';
import { DEV_TOKEN_URL, signInAsPersona } from '../persona-sign-in';

vi.mock(import('../../session-config'), async (importOriginal) => {
  const config = await importOriginal();
  return { ...config, requestSession: vi.fn(config.requestSession) };
});

function devTokenServe(
  reply: (persona: string | null) => Response,
  origin: string = DEV_TOKEN_URL
) {
  apiServer.use(
    http.get(`${origin}/token`, ({ request }) =>
      reply(new URL(request.url).searchParams.get('persona'))
    ),
    mockEndpoint(getAccount, () => HttpResponse.json(account())),
    mockEndpoint(recordMySignIn, () => HttpResponse.json(signInRecord(), { status: 201 }))
  );
}

const INTO_SLOT_0 = { mode: 'slot', slot: 0 } as const;

describe('@vp/queries: persona sign-in', () => {
  it('signs in with the token dev-token serve mints for the persona, in an httpOnly slot cookie', async () => {
    devTokenServe((persona) => HttpResponse.json({ token: `token-of-${persona}` }));

    const { value, setCookies } = await inRequest(() =>
      signInAsPersona({ data: { persona: 'creator', target: INTO_SLOT_0 } })
    );

    expect(value).toEqual({ kind: 'signed-in', slot: 0, accounts: 1 });
    expect(setCookies[0]).toBe(
      'vp.session.0=token-of-creator; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax'
    );
  });

  it('asks the token server the app named in the request context', async () => {
    vi.mocked(requestSession).mockReturnValueOnce({
      apiBaseUrl: undefined,
      cookieDomain: undefined,
      devTokenUrl: 'http://dev-token:3002',
      accountsMax: 10,
    });
    devTokenServe(
      (persona) => HttpResponse.json({ token: `token-of-${persona}` }),
      'http://dev-token:3002'
    );

    const { setCookies } = await inRequest(() =>
      signInAsPersona({ data: { persona: 'moderator', target: INTO_SLOT_0 } })
    );

    expect(setCookies[0]).toContain('vp.session.0=token-of-moderator');
  });

  it('signs in as nobody when dev-token serve is not answering', async () => {
    devTokenServe(() => new HttpResponse(null, { status: 404 }));

    await expect(
      inRequest(() => signInAsPersona({ data: { persona: 'admin', target: INTO_SLOT_0 } }))
    ).rejects.toThrow('pnpm dev starts it');
  });

  it('refuses a token handed in with the request', async () => {
    const forged = { persona: 'admin', target: INTO_SLOT_0, token: 'forged' } as const;

    await expect(inRequest(() => signInAsPersona({ data: forged }))).rejects.toThrow();
  });
});
