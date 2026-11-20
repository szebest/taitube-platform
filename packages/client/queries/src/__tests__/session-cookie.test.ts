import {
  clearSessionCookie,
  migrateLegacySession,
  occupiedSlots,
  readSessionToken,
  writeSessionCookie,
} from '../session-cookie';
import { inRequest } from './in-request';

describe('@vp/queries: session cookie', () => {
  it.each([
    {
      scenario: 'its own cookie',
      cookie: 'vp.session.0=zero; vp.session.2=two',
      slot: 2,
      token: 'two',
    },
    { scenario: 'no cookie', cookie: 'vp.session.0=zero', slot: 1, token: undefined },
    {
      scenario: 'slot 0 signed in before slots',
      cookie: 'vp.session=legacy',
      slot: 0,
      token: 'legacy',
    },
    {
      scenario: 'slot 1 beside a pre-slot cookie',
      cookie: 'vp.session=legacy',
      slot: 1,
      token: undefined,
    },
  ])('reads the token of a slot with $scenario: $token', async ({ cookie, slot, token }) => {
    const { value } = await inRequest(() => readSessionToken(slot), { cookie });

    expect(value).toBe(token);
  });

  it.each([
    {
      where: 'locally',
      url: 'http://localhost:5173/',
      domain: undefined,
      cookie: 'vp.session.3=t0ken; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax',
    },
    {
      where: 'on a real host, for the domain both apps share',
      url: 'https://studio.taitube.example/',
      domain: 'taitube.example',
      cookie:
        'vp.session.3=t0ken; Max-Age=28800; Domain=taitube.example; Path=/; HttpOnly; Secure; SameSite=Lax',
    },
  ])('writes a slot cookie no script can read $where', async ({ url, domain, cookie }) => {
    const { setCookies } = await inRequest(() => writeSessionCookie(3, 't0ken', domain), { url });

    expect(setCookies).toEqual([cookie]);
  });

  it.each([
    {
      scenario: 'slot 1',
      cookie: 'vp.session.0=a; vp.session.1=b',
      slot: 1,
      cleared: ['vp.session.1'],
    },
    {
      scenario: 'slot 0 with a pre-slot cookie',
      cookie: 'vp.session=legacy',
      slot: 0,
      cleared: ['vp.session.0', 'vp.session'],
    },
  ])(
    'clears $scenario alone, for the domain it was written for',
    async ({ cookie, slot, cleared }) => {
      const { setCookies } = await inRequest(() => clearSessionCookie(slot, 'taitube.example'), {
        url: 'https://taitube.example/',
        cookie,
      });

      expect(setCookies.map((set) => set.split(';')[0])).toEqual(cleared.map((name) => `${name}=`));
      for (const set of setCookies) {
        expect(set).toMatch(/Max-Age=0; Domain=taitube\.example; Path=\/; HttpOnly/);
      }
    }
  );

  it('names the slots the request carries a session for, lowest first', async () => {
    const { value } = await inRequest(occupiedSlots, {
      cookie: 'vp.session.4=d; vp.session.1=b; vp.session=legacy; vp.session.x=bad; vp.theme=dark',
    });

    expect(value).toEqual([0, 1, 4]);
  });

  it.each([
    {
      scenario: 'moves a pre-slot cookie into slot 0, once',
      cookie: 'vp.session=legacy',
      written: ['vp.session.0=legacy', 'vp.session='],
    },
    {
      scenario: 'drops a pre-slot cookie when slot 0 already holds one',
      cookie: 'vp.session=legacy; vp.session.0=newer',
      written: ['vp.session='],
    },
    { scenario: 'leaves a browser with slots alone', cookie: 'vp.session.0=newer', written: [] },
  ])('$scenario', async ({ cookie, written }) => {
    const { setCookies } = await inRequest(() => migrateLegacySession(undefined), { cookie });

    expect(setCookies.map((set) => set.split(';')[0])).toEqual(written);
    for (const set of setCookies) expect(set).toContain('HttpOnly');
  });
});
