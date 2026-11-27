import { createQueryClient } from '@vp/queries';
import { apiServer } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import {
  EDITOR_ID,
  INVITE_ID,
  member,
  serveTeam,
} from '#app/features/team/__tests__/team-api.fixture';
import { teamKeys } from '#app/features/team/api/team-queries';
import {
  useChangeMemberRole,
  useInviteMember,
  useRemoveMember,
  useRevokeInvite,
} from '../use-team-mutations';

function served() {
  const team = serveTeam({ members: [member(EDITOR_ID, 'editor', 'Eddie')] });
  apiServer.use(...team.handlers);
  const client = createQueryClient();
  client.setQueryData(teamKeys.members(), { members: [], invites: [] });
  return { ...team, client };
}

const refreshed = (client: ReturnType<typeof served>['client']) =>
  client.getQueryState(teamKeys.members())?.isInvalidated;

describe('apps/client/studio: team mutations', () => {
  it('sends an invite and refreshes the team', async () => {
    const { client, requests } = served();

    await runMutation(
      client,
      useInviteMember,
      { handle: 'newcomer', role: 'editor' },
      AppProviders
    );

    expect(requests.invited).toEqual([{ handle: 'newcomer', role: 'editor' }]);
    expect(refreshed(client)).toBe(true);
  });

  it('revokes an invite and refreshes the team', async () => {
    const { client, requests } = served();

    await runMutation(client, useRevokeInvite, INVITE_ID, AppProviders);

    expect(requests.revoked).toEqual([INVITE_ID]);
    expect(refreshed(client)).toBe(true);
  });

  it('changes a role and refreshes the team', async () => {
    const { client, requests } = served();

    await runMutation(
      client,
      useChangeMemberRole,
      { userId: EDITOR_ID, role: 'analytics' },
      AppProviders
    );

    expect(requests.changes).toEqual([{ userId: EDITOR_ID, role: 'analytics' }]);
    expect(refreshed(client)).toBe(true);
  });

  it('removes a member and refreshes the team', async () => {
    const { client, requests } = served();

    await runMutation(client, useRemoveMember, EDITOR_ID, AppProviders);

    expect(requests.removed).toEqual([EDITOR_ID]);
    expect(refreshed(client)).toBe(true);
  });
});
