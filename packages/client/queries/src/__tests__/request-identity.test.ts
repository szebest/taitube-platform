import { requestHandler } from '@tanstack/react-start/server';
import { resolveRequestIdentity } from '../request-identity';

async function resolve(
  path: string,
  { cookie = '', slot }: { cookie?: string; slot?: string } = {}
) {
  const resolved: { value?: ReturnType<typeof resolveRequestIdentity> } = {};
  const request = new Request(`http://localhost:5173${path}`, {
    headers: { cookie, ...(slot && { 'x-account-slot': slot }) },
  });
  await requestHandler(async () => {
    resolved.value = resolveRequestIdentity();
    return new Response(null);
  })(request, {});
  return resolved.value;
}

const accounts = (defaultSlot: number, channel: string | null = null) =>
  `vp.accounts=${encodeURIComponent(
    JSON.stringify({
      defaultSlot,
      slots: [
        { slot: defaultSlot, userId: 'u', label: 'U', avatarUrl: null, channel, expired: false },
      ],
    })
  )}`;

describe('@vp/queries: request identity', () => {
  it.each([
    {
      scenario: 'the prefix',
      path: '/u/2/c/two/watch/x',
      options: { cookie: 'vp.session.2=t', slot: '1' },
      identity: { slot: 2, channel: 'two' },
      prefixed: true,
    },
    {
      scenario: 'X-Account-Slot, with no prefix',
      path: '/api/v1/me',
      options: { cookie: 'vp.session.0=a; vp.session.1=b', slot: '1' },
      identity: { slot: 1 },
      prefixed: false,
    },
    {
      scenario: 'the remembered default',
      path: '/watch/x',
      options: { cookie: `vp.session.0=a; vp.session.3=c; ${accounts(3, 'three')}` },
      identity: { slot: 3, channel: 'three' },
      prefixed: false,
    },
    {
      scenario: 'the lowest slot holding a session, when the default has none',
      path: '/watch/x',
      options: { cookie: `vp.session.4=d; ${accounts(1)}` },
      identity: { slot: 4 },
      prefixed: false,
    },
    {
      scenario: 'slot 0 for a guest',
      path: '/',
      options: {},
      identity: { slot: 0 },
      prefixed: false,
    },
  ])('acts as $identity from $scenario', async ({ path, options, identity, prefixed }) => {
    expect(await resolve(path, options)).toMatchObject({ identity, prefixed });
  });

  it('hands back the path the routes match and the slots holding a session', async () => {
    expect(
      await resolve('/u/1/watch/x', { cookie: 'vp.session.1=b; vp.session=legacy' })
    ).toMatchObject({ pathname: '/watch/x', occupied: [0, 1] });
  });
});
