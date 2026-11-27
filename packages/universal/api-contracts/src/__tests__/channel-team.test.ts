import {
  acceptChannelInvite,
  changeChannelMemberRole,
  createChannelInvite,
  declineChannelInvite,
  getChannelTeam,
  listChannelAudit,
  listMyMemberships,
  removeChannelMember,
  revokeChannelInvite,
} from '../channel-team';
import type { EndpointContract } from '../endpoint';

describe('packages/api-contracts: channel team', () => {
  it.each<{ endpoint: EndpointContract; scoped: true | undefined }>([
    { endpoint: getChannelTeam, scoped: true },
    { endpoint: createChannelInvite, scoped: true },
    { endpoint: revokeChannelInvite, scoped: true },
    { endpoint: changeChannelMemberRole, scoped: true },
    { endpoint: removeChannelMember, scoped: true },
    { endpoint: listChannelAudit, scoped: true },
    { endpoint: acceptChannelInvite, scoped: undefined },
    { endpoint: declineChannelInvite, scoped: undefined },
    { endpoint: listMyMemberships, scoped: undefined },
  ])('$endpoint.method $endpoint.path acts on a named channel: $scoped', ({ endpoint, scoped }) => {
    expect(endpoint.channelScoped).toBe(scoped);
  });

  it.each([
    { scenario: 'a role', body: { handle: 'ada', role: 'editor' }, ok: true },
    { scenario: 'the owner role', body: { handle: 'ada', role: 'owner' }, ok: false },
    { scenario: 'an empty handle', body: { handle: '', role: 'editor' }, ok: false },
  ])('checks an invite of $scenario', ({ body, ok }) => {
    expect(createChannelInvite.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    { scenario: 'an action', query: { action: 'member.left' }, ok: true },
    { scenario: 'a moderation action', query: { action: 'comment.held' }, ok: true },
    { scenario: 'an unknown action', query: { action: 'member.deleted' }, ok: false },
    {
      scenario: 'an actor',
      query: { actorUserId: '00000000-0000-7000-8000-00000000000a' },
      ok: true,
    },
    { scenario: 'an actor that is no id', query: { actorUserId: 'ada' }, ok: false },
  ])('checks an audit filter of $scenario', ({ query, ok }) => {
    expect(listChannelAudit.query.safeParse(query).success).toBe(ok);
  });
});
