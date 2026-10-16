import { hasSession, signOut } from '../session-functions';
import { inRequest } from './in-request';

describe('@vp/queries: session server functions', () => {
  it.each([
    { cookie: 'vp.session=t0ken', expected: true },
    { cookie: 'vp.theme=dark', expected: false },
  ])('sees a session in "$cookie": $expected', async ({ cookie, expected }) => {
    expect((await inRequest(() => hasSession(), { cookie })).value).toBe(expected);
  });

  it('signs out by clearing the session cookie', async () => {
    const { setCookies } = await inRequest(() => signOut(), { cookie: 'vp.session=t0ken' });

    expect(setCookies).toEqual([
      expect.stringMatching(/^vp\.session=; Max-Age=0; Path=\/; HttpOnly/),
    ]);
  });
});
