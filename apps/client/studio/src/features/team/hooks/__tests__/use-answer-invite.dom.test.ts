import { createQueryClient } from '@vp/queries';
import { apiServer } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { AppProviders } from '#app/__tests__/providers';
import { MY_INVITE_ID, myInvite, serveTeam } from '#app/features/team/__tests__/team-api.fixture';
import { teamKeys } from '#app/features/team/api/team-queries';
import { useAcceptInvite, useDeclineInvite } from '../use-answer-invite';

function served() {
  const team = serveTeam({ myInvites: [myInvite('editor')] });
  apiServer.use(...team.handlers);
  const client = createQueryClient();
  client.setQueryData(teamKeys.myInvites(), { pages: [], pageParams: [] });
  client.setQueryData(teamKeys.memberships(), { items: [] });
  return { ...team, client };
}

const refreshed = (client: ReturnType<typeof served>['client'], key: readonly string[]) =>
  client.getQueryState(key)?.isInvalidated;

describe('apps/client/studio: invite answers', () => {
  it('accepts an invite and reads the invites and the memberships again', async () => {
    const { client, requests } = served();

    await runMutation(client, useAcceptInvite, MY_INVITE_ID, AppProviders);

    expect(requests.accepted).toEqual([MY_INVITE_ID]);
    expect(refreshed(client, teamKeys.myInvites())).toBe(true);
    expect(refreshed(client, teamKeys.memberships())).toBe(true);
  });

  it('declines an invite and reads the invites again, leaving the memberships be', async () => {
    const { client, requests } = served();

    await runMutation(client, useDeclineInvite, MY_INVITE_ID, AppProviders);

    expect(requests.declined).toEqual([MY_INVITE_ID]);
    expect(refreshed(client, teamKeys.myInvites())).toBe(true);
    expect(refreshed(client, teamKeys.memberships())).toBe(false);
  });
});
