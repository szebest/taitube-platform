import { isRedirect } from '@tanstack/react-router';
import { account } from '@vp/web-testing';
import { createIdentityStore } from '../identity-store';
import { LoginSearchSchema, leaveLoginWhenSignedIn, requireSignedIn } from '../route-guards';
import { GUEST, type Session } from '../session';

const SIGNED_IN: Session = { status: 'signed-in', account: account() };

const ON_SLOT_1 = createIdentityStore({ identity: { slot: 1 }, prefixed: true });

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
    { reason: 'expired', kept: 'expired' },
    { reason: 'banned', kept: undefined },
    { reason: undefined, kept: undefined },
  ])('keeps the reason $reason for being sent to /login: $kept', ({ reason, kept }) => {
    expect(LoginSearchSchema.parse({ reason }).reason).toBe(kept);
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
    { slot: '3', add: undefined, kept: { slot: 3, add: undefined } },
    { slot: '11', add: '1', kept: { slot: undefined, add: true } },
    { slot: undefined, add: 'yes', kept: { slot: undefined, add: undefined } },
  ])('keeps slot $slot and add $add from the search: $kept', ({ slot, add, kept }) => {
    expect(LoginSearchSchema.parse({ slot, add })).toMatchObject(kept);
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
    const search = { redirect, reason: undefined, slot: undefined, add: undefined };

    expect(
      redirectOf(() => leaveLoginWhenSignedIn({ context: { auth, identity: ON_SLOT_1 }, search }))
    ).toEqual(sent);
  });

  it.each([
    { asked: 'to add an account', slot: undefined, add: true as const, stays: true },
    { asked: 'to sign another slot in again', slot: 2, add: undefined, stays: true },
    { asked: 'to sign its own slot in, already signed in', slot: 1, add: undefined, stays: false },
  ])('keeps a signed-in viewer on /login asked $asked: $stays', ({ slot, add, stays }) => {
    const search = { redirect: '/upload', reason: undefined, slot, add };

    expect(
      redirectOf(() =>
        leaveLoginWhenSignedIn({ context: { auth: SIGNED_IN, identity: ON_SLOT_1 }, search })
      ) === undefined
    ).toBe(stays);
  });
});
