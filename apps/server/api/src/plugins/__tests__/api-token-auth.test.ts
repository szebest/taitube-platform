import { err, ok } from '@kit/result';
import type { ActingChannel } from '@vp/domain';
import { channelMembershipRequired } from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import type { FastifyRequest } from 'fastify';
import { carriesSession, routeScopes, tokenIdentity } from '../api-token-auth';

const CHANNEL_ID = '00000000-0000-7000-8000-0000000019d1';
const OTHER_ID = '00000000-0000-7000-8000-0000000019d2';
const USER: UserContext = { id: 'usr-1', role: 'USER' };
const ACTING: ActingChannel = { channelId: CHANNEL_ID, ownerId: 'usr-1', role: 'owner' };
const GRANT = { id: 'tok-1', channelId: CHANNEL_ID, scopes: ['analytics:read' as const] };

const withCookie = (cookie?: string) => ({ headers: { cookie } }) as unknown as FastifyRequest;

describe('apps/server/api/plugins: api token auth', () => {
  it.each([
    { cookie: 'vp.session=abc', carries: true },
    { cookie: 'vp.theme=sand; vp.session=abc', carries: true },
    { cookie: 'vp.theme=sand', carries: false },
    { cookie: 'vp.sessionx=abc', carries: false },
    { cookie: undefined, carries: false },
  ])('tells the session cookie in $cookie: $carries', ({ cookie, carries }) => {
    expect(carriesSession(withCookie(cookie))).toBe(carries);
  });

  it.each([
    { key: 'PATCH /v1/creator/videos/:id', scope: 'videos:write' },
    { key: 'PATCH /creator/videos/:id', scope: 'videos:write' },
    { key: 'GET /v1/creator/channel/analytics', scope: 'analytics:read' },
    { key: 'POST /v1/me/api-tokens', scope: undefined },
    { key: 'PATCH /v1/me/channel', scope: undefined },
  ])('maps $key to $scope', ({ key, scope }) => {
    expect(routeScopes().get(key)).toBe(scope);
  });

  it('keeps the identity of a token on its own channel, header or none', () => {
    const identity = { user: USER, acting: ok(ACTING) };

    expect(expectOk(tokenIdentity(identity, GRANT, undefined))).toEqual(identity);
    expect(expectOk(tokenIdentity(identity, GRANT, CHANNEL_ID))).toEqual(identity);
  });

  it('refuses another channel named in the header where a channel is needed', () => {
    const identity = { user: USER, acting: ok(ACTING) };

    expect(expectOk(tokenIdentity(identity, GRANT, OTHER_ID)).acting).toEqual(
      err(channelMembershipRequired(OTHER_ID))
    );
  });

  it('refuses the token outright once its channel is out of reach', () => {
    const identity = { user: USER, acting: err(channelMembershipRequired(CHANNEL_ID)) };

    expect(expectErr(tokenIdentity(identity, GRANT, undefined))).toMatchObject({
      code: 'UNAUTHORIZED',
      reason: 'the token channel is out of reach',
    });
  });
});
