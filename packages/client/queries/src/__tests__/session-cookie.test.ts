import { SESSION_COOKIE } from '../session-config';
import {
  clearSessionCookie,
  readSessionToken,
  readVideoAccessCookies,
  reissueVideoAccessCookies,
  writeSessionCookie,
} from '../session-cookie';
import { inRequest } from './in-request';

const UNLOCK = 'vp.video-access.0190c3a0-5e1d-7000-8000-00000000a001=signed';
const OTHER_UNLOCK = 'vp.video-access.0190c3a0-5e1d-7000-8000-00000000a002=signed';

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

  it.each([
    {
      held: 'two unlocks among other cookies',
      cookie: `vp.theme=dark; ${UNLOCK}; ${OTHER_UNLOCK}`,
      header: `${UNLOCK}; ${OTHER_UNLOCK}`,
    },
    { held: 'no unlock', cookie: 'vp.session=t0ken; vp.theme=dark', header: undefined },
  ])('reads $held as the Cookie header the API is told', async ({ cookie, header }) => {
    const { value } = await inRequest(readVideoAccessCookies, { cookie });

    expect(value).toBe(header);
  });

  it('re-issues an unlock that names no lifetime for the 12 hours an unlock lasts, and nothing that is not an unlock', async () => {
    const { setCookies } = await inRequest(() =>
      reissueVideoAccessCookies([`${UNLOCK}; Path=/`, '', 'api=1'])
    );

    expect(setCookies).toEqual([`${UNLOCK}; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`]);
  });
});
