import type { APIRequestContext } from '@playwright/test';
import { type Stack, expect, test } from '../../../../../tests/playwright/fixtures';
import type { Persona } from '../../../../../tests/playwright/stack';

const NO_ID = '00000000-0000-7000-8000-000000000000';

type TeamAttempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: (team: Stack['team']) => string;
  data?: Record<string, unknown>;
};

const TEAM_ATTEMPTS: TeamAttempt[] = [
  { name: 'read the team', method: 'GET', path: () => '/v1/me/channel/members' },
  {
    name: 'invite to the team',
    method: 'POST',
    path: () => '/v1/me/channel/invites',
    data: { handle: 'nobody', role: 'analytics' },
  },
  { name: 'revoke an invite', method: 'DELETE', path: () => `/v1/me/channel/invites/${NO_ID}` },
  {
    name: "change a member's role",
    method: 'PATCH',
    path: ({ userIds }) => `/v1/me/channel/members/${userIds.analytics}`,
    data: { role: 'moderator' },
  },
  {
    name: 'remove a member',
    method: 'DELETE',
    path: ({ userIds }) => `/v1/me/channel/members/${userIds.manager}`,
  },
  { name: 'read the audit log', method: 'GET', path: () => '/v1/me/channel/audit' },
  {
    name: 'read the comment settings',
    method: 'GET',
    path: () => '/v1/me/channel/comment-settings',
  },
  {
    name: 'replace the comment settings',
    method: 'PUT',
    path: () => '/v1/me/channel/comment-settings',
    data: {
      reviewMode: 'none',
      blockedWords: [],
      linkAllowlist: [],
      slowModeSeconds: null,
      subscribersOnly: false,
      minAccountAgeDays: 0,
      disclosure: {
        hide: 'silent',
        remove: 'visible',
        manual_hold: 'visible',
        'auto.blocked_words': 'silent',
        'auto.links': 'visible',
        'auto.review_all': 'visible',
      },
    },
  },
  {
    name: 'read the trusted commenters',
    method: 'GET',
    path: () => '/v1/me/channel/trusted-commenters',
  },
  {
    name: 'trust a commenter',
    method: 'PUT',
    path: () => `/v1/me/channel/trusted-commenters/${NO_ID}`,
  },
];

/** Moderators run the comment queue, so only the roles without `comment.moderate` are refused these. */
const MODERATION_ATTEMPTS: TeamAttempt[] = [
  { name: 'list the restricted users', method: 'GET', path: () => '/v1/me/channel/restrictions' },
  {
    name: 'shadow ban a user',
    method: 'PUT',
    path: () => `/v1/me/channel/restrictions/${NO_ID}`,
    data: { action: 'shadow_ban' },
  },
  {
    name: 'lift a restriction',
    method: 'DELETE',
    path: () => `/v1/me/channel/restrictions/${NO_ID}`,
  },
];

const SIGNED_IN_ATTEMPTS: TeamAttempt[] = [
  ...TEAM_ATTEMPTS,
  { name: 'accept an invite', method: 'POST', path: () => `/v1/invites/${NO_ID}/accept`, data: {} },
  {
    name: 'decline an invite',
    method: 'POST',
    path: () => `/v1/invites/${NO_ID}/decline`,
    data: {},
  },
  { name: 'list the channels worked on', method: 'GET', path: () => '/v1/me/memberships' },
];

type Refusal = {
  caller: string;
  persona?: Persona;
  attempt: TeamAttempt;
  status: number;
  code: string;
};

const OFF_ROLES: { caller: string; persona: Persona; code: string }[] = [
  { caller: 'an editor', persona: 'editor', code: 'FORBIDDEN' },
  { caller: 'a moderator', persona: 'moderator', code: 'FORBIDDEN' },
  { caller: 'an analytics viewer', persona: 'analytics', code: 'FORBIDDEN' },
  { caller: 'a user off the team', persona: 'viewer', code: 'CHANNEL_MEMBERSHIP_REQUIRED' },
];

const MANAGER_ATTEMPTS: (TeamAttempt & { status: number; code: string })[] = [
  {
    name: 'invite a manager',
    method: 'POST',
    path: () => '/v1/me/channel/invites',
    data: { handle: 'nobody', role: 'manager' },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'make a member a manager',
    method: 'PATCH',
    path: ({ userIds }) => `/v1/me/channel/members/${userIds.analytics}`,
    data: { role: 'manager' },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'demote the owner',
    method: 'PATCH',
    path: ({ ownerId }) => `/v1/me/channel/members/${ownerId}`,
    data: { role: 'editor' },
    status: 400,
    code: 'CHANNEL_OWNER_IMMUTABLE',
  },
  {
    name: 'remove the owner',
    method: 'DELETE',
    path: ({ ownerId }) => `/v1/me/channel/members/${ownerId}`,
    status: 400,
    code: 'CHANNEL_OWNER_IMMUTABLE',
  },
];

const REFUSALS: Refusal[] = [
  ...SIGNED_IN_ATTEMPTS.map((attempt) => ({
    caller: 'an anonymous caller',
    attempt,
    status: 401,
    code: 'UNAUTHORIZED',
  })),
  ...OFF_ROLES.flatMap(({ caller, persona, code }) =>
    TEAM_ATTEMPTS.map((attempt) => ({ caller, persona, attempt, status: 403, code }))
  ),
  ...OFF_ROLES.filter(({ persona }) => persona !== 'moderator').flatMap(
    ({ caller, persona, code }) =>
      MODERATION_ATTEMPTS.map((attempt) => ({ caller, persona, attempt, status: 403, code }))
  ),
  ...MODERATION_ATTEMPTS.map((attempt) => ({
    caller: 'an anonymous caller',
    attempt,
    status: 401,
    code: 'UNAUTHORIZED',
  })),
  ...MANAGER_ATTEMPTS.map(({ status, code, ...attempt }) => ({
    caller: 'a manager',
    persona: 'manager' as const,
    attempt,
    status,
    code,
  })),
];

test.describe('only the owner and managers run a channel team', () => {
  for (const { caller, persona, attempt, status, code } of REFUSALS) {
    test(`${caller} cannot ${attempt.name}`, async ({ api, stack }) => {
      const client = await api(persona, { channelId: stack.team.channelId });

      const response = await client.fetch(attempt.path(stack.team), {
        method: attempt.method,
        data: attempt.data,
      });

      expect(response.status()).toBe(status);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      expect(await response.json()).toMatchObject({ status, code });
    });
  }
});

test.describe('a removed manager brings no one in', () => {
  test('the invite a manager sent cannot be accepted once they are removed', async ({
    api,
    stack,
  }) => {
    const { channelId } = stack.team;
    const creator = await api('creator');
    const recruiter = await api('recruiter', { channelId });
    const recruit = await api('recruit');
    const accountOf = async (client: APIRequestContext) =>
      (await (await client.get('/v1/me/account')).json()) as {
        id: string;
        channel: { handle: string };
      };
    const [recruiterAccount, recruitAccount] = [
      await accountOf(recruiter),
      await accountOf(recruit),
    ];

    const hired = await creator.post('/v1/me/channel/invites', {
      data: { handle: recruiterAccount.channel.handle, role: 'manager' },
    });
    expect((await recruiter.post(`/v1/invites/${(await hired.json()).id}/accept`)).status()).toBe(
      200
    );
    const sent = await recruiter.post('/v1/me/channel/invites', {
      data: { handle: recruitAccount.channel.handle, role: 'editor' },
    });
    expect(sent.status()).toBe(201);
    const removed = await creator.delete(`/v1/me/channel/members/${recruiterAccount.id}`);
    expect(removed.status()).toBe(204);

    const accepted = await recruit.post(`/v1/invites/${(await sent.json()).id}/accept`);

    expect(accepted.status()).toBe(409);
    expect(await accepted.json()).toMatchObject({ code: 'CHANNEL_INVITE_NOT_PENDING' });
  });
});
