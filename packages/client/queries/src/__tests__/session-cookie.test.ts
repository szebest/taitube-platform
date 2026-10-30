import {
  SESSION_COOKIE,
  clearSessionCookie,
  readSessionToken,
  writeSessionCookie,
} from '../session-cookie';
import { inRequest } from './in-request';

describe('@vp/queries: session cookie', () => {
  it('reads the token of the request being answered', async () => {
    const { value } = await inRequest(readSessionToken, { cookie: `${SESSION_COOKIE}=t0ken` });

    expect(value).toBe('t0ken');
  });

  it.each([
    {
      where: 'locally',
      url: 'http://localhost:5173/',
      domain: undefined,
      cookie: 'vp.session=t0ken; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax',
    },
    {
      where: 'on a real host, for the domain both apps share',
      url: 'https://studio.taitube.example/',
      domain: 'taitube.example',
      cookie:
        'vp.session=t0ken; Max-Age=28800; Domain=taitube.example; Path=/; HttpOnly; Secure; SameSite=Lax',
    },
  ])('writes a cookie no script can read $where', async ({ url, domain, cookie }) => {
    const { setCookies } = await inRequest(() => writeSessionCookie('t0ken', domain), { url });

    expect(setCookies).toEqual([cookie]);
  });

  it('clears the cookie for the same domain it was written for', async () => {
    const { setCookies } = await inRequest(() => clearSessionCookie('taitube.example'), {
      url: 'https://taitube.example/',
    });

    expect(setCookies).toEqual([
      expect.stringMatching(/^vp\.session=; Max-Age=0; Domain=taitube\.example; Path=\/; /),
    ]);
  });
});
