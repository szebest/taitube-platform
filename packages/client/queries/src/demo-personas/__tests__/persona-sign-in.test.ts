import { apiServer } from '@vp/web-testing';
import { http, HttpResponse } from 'msw/http';
import { inRequest } from '../../__tests__/in-request';
import { requestDevTokenUrl } from '../../session-config';
import { DEV_TOKEN_URL, signInAsPersona } from '../persona-sign-in';

vi.mock(import('../../session-config'), async (importOriginal) => ({
  ...(await importOriginal()),
  requestDevTokenUrl: vi.fn(),
}));

function devTokenServe(
  reply: (persona: string | null) => Response,
  origin: string = DEV_TOKEN_URL
) {
  apiServer.use(
    http.get(`${origin}/token`, ({ request }) =>
      reply(new URL(request.url).searchParams.get('persona'))
    )
  );
}

describe('@vp/queries: persona sign-in', () => {
  it('signs in with the token dev-token serve mints for the persona, in an httpOnly cookie', async () => {
    devTokenServe((persona) => HttpResponse.json({ token: `token-of-${persona}` }));

    const { setCookies } = await inRequest(() => signInAsPersona({ data: { persona: 'creator' } }));

    expect(setCookies).toEqual([
      'vp.session=token-of-creator; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax',
    ]);
  });

  it('asks the token server the app named in the request context', async () => {
    vi.mocked(requestDevTokenUrl).mockReturnValueOnce('http://dev-token:3002');
    devTokenServe(
      (persona) => HttpResponse.json({ token: `token-of-${persona}` }),
      'http://dev-token:3002'
    );

    const { setCookies } = await inRequest(() =>
      signInAsPersona({ data: { persona: 'moderator' } })
    );

    expect(setCookies[0]).toContain('vp.session=token-of-moderator');
  });

  it('signs in as nobody when dev-token serve is not answering', async () => {
    devTokenServe(() => new HttpResponse(null, { status: 404 }));

    await expect(inRequest(() => signInAsPersona({ data: { persona: 'admin' } }))).rejects.toThrow(
      'pnpm dev starts it'
    );
  });
});
