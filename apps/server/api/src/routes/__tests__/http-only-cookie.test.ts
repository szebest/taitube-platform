import { httpOnlyCookie } from '../http-only-cookie';

describe('apps/server/api/routes: httpOnlyCookie', () => {
  it.each([
    { secure: false, expected: 'name=value; Path=/; HttpOnly; SameSite=Lax; Max-Age=60' },
    { secure: true, expected: 'name=value; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure' },
  ])('writes the cookie with secure $secure', ({ secure, expected }) => {
    expect(httpOnlyCookie('name', 'value', { maxAgeSeconds: 60, secure })).toBe(expected);
  });
});
