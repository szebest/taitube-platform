import { type Stack, expect, test } from '../../../../../tests/playwright/fixtures';
import type { Persona } from '../../../../../tests/playwright/stack';

const NO_ID = '00000000-0000-7000-8000-000000000000';

type TeamAttempt = {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
