import { isRedirect } from '@tanstack/react-router';
import { account } from '@vp/web-testing';

import { LoginSearchSchema, leaveLoginWhenSignedIn, requireSignedIn } from '../route-guards';
import { GUEST, type Session } from '../session';

const SIGNED_IN: Session = { status: 'signed-in', account: account() };

function redirectOf(guard: () => void): object | undefined {
  try {
    guard();
    return undefined;
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    const { to, href, search } = thrown.options;
    return { to, href, search };
  }
}

describe('@vp/queries: route guards', () => {
  it.each([
    { redirect: '/upload', kept: '/upload' },
    { redirect: '/watch/abc?t=12', kept: '/watch/abc?t=12' },
    { redirect: '//evil.example/steal', kept: undefined },
    { redirect: '/\\evil.example/steal', kept: undefined },
    { redirect: 'http://localhost/elsewhere', kept: undefined },
    { redirect: 'https://evil.example/', kept: undefined },
    { redirect: 'javascript:alert(1)', kept: undefined },
  ])('keeps $redirect as where to go after signing in: $kept', ({ redirect, kept }) => {
    expect(LoginSearchSchema.parse({ redirect }).redirect).toBe(kept);
  });

  it.each([
    {
      viewer: 'a guest',
      auth: GUEST,
      sent: { to: '/login', href: undefined, search: { redirect: '/upload?draft=1' } },
    },
    { viewer: 'a signed-in viewer', auth: SIGNED_IN, sent: undefined },
  ])('sends $viewer of a members-only page to: $sent', ({ auth, sent }) => {
    const location = { href: '/upload?draft=1' };

    expect(redirectOf(() => requireSignedIn({ context: { auth }, location }))).toEqual(sent);
  });

  it.each([
    { viewer: 'a guest', auth: GUEST, redirect: '/upload', sent: undefined },
    {
      viewer: 'a signed-in viewer',
      auth: SIGNED_IN,
      redirect: '/upload',
      sent: { to: undefined, href: '/upload', search: undefined },
    },
    {
      viewer: 'a signed-in viewer asked for nowhere',
      auth: SIGNED_IN,
      redirect: undefined,
      sent: { to: undefined, href: '/', search: undefined },
    },
  ])('sends $viewer on /login to: $sent', ({ auth, redirect, sent }) => {
    expect(
      redirectOf(() => leaveLoginWhenSignedIn({ context: { auth }, search: { redirect } }))
    ).toEqual(sent);
  });
});
