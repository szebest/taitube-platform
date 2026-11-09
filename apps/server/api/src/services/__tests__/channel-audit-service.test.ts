import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ActingRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedTeamMember } from '../../__tests__/test-app';
import { ChannelAuditService, type ChannelAuditQuery } from '../channel-audit-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000017c1', role: 'USER' };
const MEMBER_ID = '00000000-0000-7000-8000-0000000017c2';

async function setup() {
  const repositories = new InMemoryRepositories();
  const channelId = await seedTeamMember(repositories, {
    ownerId: OWNER.id,
    memberId: MEMBER_ID,
    role: 'manager',
  });
  const service = new ChannelAuditService({
    audit: repositories.channelAudit,
    channels: repositories.channels,
    paginator: new Paginator(),
  });
  const list = (query: ChannelAuditQuery = {}, role: ActingRole = 'owner') =>
    service.list(
      role === 'owner'
        ? OWNER
        : {
            id: MEMBER_ID,
            role: 'USER',
            memberships: { [channelId]: { role, ownerId: OWNER.id } },
          },
      { channelId, ownerId: OWNER.id, role },
      query
    );
  return { list };
}

describe('apps/server/api/services: ChannelAuditService', () => {
  it('reads the log newest first, with the actor as their channel shows them', async () => {
    const { list } = await setup();

    expect(expectOk(await list()).items).toMatchObject([
      { action: 'invite.accepted', actorUserId: MEMBER_ID, actor: null },
      {
        action: 'invite.created',
        actorUserId: OWNER.id,
        actor: { handle: 'team-owner', displayName: 'Owner', avatarUrl: null },
      },
    ]);
  });

  it.each([
    { scenario: 'an actor', query: { actorUserId: OWNER.id }, actions: ['invite.created'] },
    {
      scenario: 'an action',
      query: { action: 'invite.accepted' as const },
      actions: ['invite.accepted'],
    },
  ])('narrows to $scenario', async ({ query, actions }) => {
    const { list } = await setup();

    expect(expectOk(await list(query)).items.map(({ action }) => action)).toEqual(actions);
  });

  it('walks the log a page at a time', async () => {
    const { list } = await setup();

    const first = expectOk(await list({ limit: 1 }));
    const second = expectOk(await list({ limit: 1, cursor: first.nextCursor ?? undefined }));

    expect([...first.items, ...second.items].map(({ action }) => action)).toEqual([
      'invite.accepted',
      'invite.created',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it.each<{ scenario: string; query: ChannelAuditQuery; role: ActingRole; code: string }>([
    { scenario: 'an editor reads it', query: {}, role: 'editor', code: ErrorCodes.FORBIDDEN },
    {
      scenario: 'the cursor is broken',
      query: { cursor: 'nope' },
      role: 'owner',
      code: ErrorCodes.INVALID_CURSOR,
    },
  ])('refuses when $scenario', async ({ query, role, code }) => {
    const { list } = await setup();

    expect(expectErr(await list(query, role)).code).toBe(code);
  });
});
