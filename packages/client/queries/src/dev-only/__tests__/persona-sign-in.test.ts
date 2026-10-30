import { apiServer } from '@vp/web-testing';
import { HttpResponse, http } from 'msw/http';
import { inRequest } from '../../__tests__/in-request';
import { DEV_TOKEN_URL, signInAsPersona } from '../persona-sign-in';

function devTokenServe(reply: (persona: string | null) => Response) {
  apiServer.use(
    http.get(`${DEV_TOKEN_URL}/token`, ({ request }) =>
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

  it('signs in as nobody when dev-token serve is not answering', async () => {
    devTokenServe(() => new HttpResponse(null, { status: 404 }));

    await expect(inRequest(() => signInAsPersona({ data: { persona: 'admin' } }))).rejects.toThrow(
      'pnpm dev starts it'
    );
  });
});
