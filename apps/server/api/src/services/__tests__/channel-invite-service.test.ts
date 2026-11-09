import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { ActingChannel } from '@vp/domain';
import { type AnyFailure, ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelInviteService } from '../channel-invite-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000017a1', role: 'USER' };
const INVITEE: UserContext = { id: '00000000-0000-7000-8000-0000000017a2', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000017a3', role: 'USER' };
const NOW = Date.parse('2026-11-01T00:00:00.000Z');

async function setup() {
  const repositories = new InMemoryRepositories();
  const own = expectOk(
    await repositories.channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' })
  );
  expectOk(
    await repositories.channels.create({ userId: INVITEE.id, handle: 'ada', displayName: 'Ada' })
  );
  const service = new ChannelInviteService({
    invites: repositories.channelInvites,
    members: repositories.channelMembers,
    channels: repositories.channels,
    now: () => NOW,
    paginator: new Paginator(),
  });
  const acting: ActingChannel = { channelId: own.id, ownerId: OWNER.id, role: 'owner' };
  const invite = async (handle = 'ada') =>
    service.create(OWNER, acting, { handle, role: 'editor' });
  return { repositories, service, acting, invite };
}

describe('apps/server/api/services: ChannelInviteService', () => {
  it('invites the account behind a handle and tells them', async () => {
    const { repositories, invite } = await setup();

    expect(expectOk(await invite())).toMatchObject({
      inviteeUserId: INVITEE.id,
      role: 'editor',
      status: 'pending',
      invitedBy: OWNER.id,
      expiresAt: '2026-11-15T00:00:00.000Z',
      invitee: { handle: 'ada', displayName: 'Ada', avatarUrl: null },
    });
    expect(expectOk(await repositories.outbox.claimBatch(10))).toHaveLength(1);
  });

  it.each([
    {
      scenario: 'no channel has the handle',
      twice: false,
      handle: 'nobody',
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    {
      scenario: 'an invite is pending',
      twice: true,
      handle: 'ada',
      code: ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING,
    },
    {
      scenario: 'the handle is the owner',
      twice: false,
      handle: 'owner',
      code: ErrorCodes.CHANNEL_MEMBER_EXISTS,
    },
  ])('refuses an invite when $scenario', async ({ twice, handle, code }) => {
    const { invite } = await setup();
    if (twice) expectOk(await invite(handle));

    expect(expectErr(await invite(handle)).code).toBe(code);
  });

  it('refuses to invite a member', async () => {
    const { service, invite } = await setup();
    expectOk(await service.accept(INVITEE, expectOk(await invite()).id));

    expect(expectErr(await invite()).code).toBe(ErrorCodes.CHANNEL_MEMBER_EXISTS);
  });

  it('joins the invitee to the channel they were invited to', async () => {
    const { service, acting, invite } = await setup();
    const { id } = expectOk(await invite());

    expect(expectOk(await service.accept(INVITEE, id))).toEqual({
      channelId: acting.channelId,
      ownerId: acting.ownerId,
      role: 'editor',
      channel: { handle: 'owner', displayName: 'Owner', avatarUrl: null },
    });
  });

  it.each<{
    scenario: string;
    answer: (service: ChannelInviteService, id: string) => Promise<Result<unknown, AnyFailure>>;
    code: string;
  }>([
    {
      scenario: 'someone else answers it',
      answer: (service, id) => service.accept(STRANGER, id),
      code: ErrorCodes.CHANNEL_INVITE_NOT_FOUND,
    },
    {
      scenario: 'it was declined',
      answer: async (service, id) => {
        expectOk(await service.decline(INVITEE, id));
        return service.accept(INVITEE, id);
      },
      code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
    },
    {
      scenario: 'it was accepted',
      answer: async (service, id) => {
        expectOk(await service.accept(INVITEE, id));
        return service.decline(INVITEE, id);
      },
      code: ErrorCodes.CHANNEL_INVITE_NOT_PENDING,
    },
  ])('refuses an answer when $scenario', async ({ answer, code }) => {
    const { service, invite } = await setup();
    const { id } = expectOk(await invite());

    expect(expectErr(await answer(service, id)).code).toBe(code);
  });

  it('revokes a pending invite once, so it can no longer be accepted', async () => {
    const { service, acting, invite } = await setup();
    const { id } = expectOk(await invite());

    expectOk(await service.revoke(OWNER, acting, id));

    expect(expectErr(await service.revoke(OWNER, acting, id)).code).toBe(
      ErrorCodes.CHANNEL_INVITE_NOT_PENDING
    );
    expect(expectErr(await service.accept(INVITEE, id)).code).toBe(
      ErrorCodes.CHANNEL_INVITE_NOT_PENDING
    );
  });

  it('does not find an invite to another channel', async () => {
    const { service, invite } = await setup();
    const { id } = expectOk(await invite());
    const elsewhere: ActingChannel = {
      channelId: 'chan-other',
      ownerId: STRANGER.id,
      role: 'owner',
    };

    expect(expectErr(await service.revoke(STRANGER, elsewhere, id)).code).toBe(
      ErrorCodes.CHANNEL_INVITE_NOT_FOUND
    );
  });

  describe('listMine', () => {
    it('lists the caller pending invites with the channel and who sent them', async () => {
      const { repositories, service, acting, invite } = await setup();
      const { id } = expectOk(await invite());

      expect(expectOk(await service.listMine(INVITEE, {}))).toEqual({
        items: [
          {
            id,
            channel: {
              id: acting.channelId,
              handle: 'owner',
              displayName: 'Owner',
              avatarUrl: null,
            },
            role: 'editor',
            invitedByName: 'Owner',
            expiresAt: '2026-11-15T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      });
      expect(expectOk(await repositories.channelInvites.findById(id))?.status).toBe('pending');
    });

    it.each<{
      scenario: string;
      change: (ctx: {
        service: ChannelInviteService;
        id: string;
        acting: ActingChannel;
      }) => Promise<unknown>;
      asking: UserContext;
    }>([
      { scenario: 'another user asks', change: async () => undefined, asking: STRANGER },
      {
        scenario: 'it was declined',
        change: ({ service, id }) => service.decline(INVITEE, id),
        asking: INVITEE,
      },
      {
        scenario: 'it was accepted',
        change: ({ service, id }) => service.accept(INVITEE, id),
        asking: INVITEE,
      },
      {
        scenario: 'it was revoked',
        change: ({ service, id, acting }) => service.revoke(OWNER, acting, id),
        asking: INVITEE,
      },
    ])('does not list it when $scenario', async ({ change, asking }) => {
      const { service, acting, invite } = await setup();
      const { id } = expectOk(await invite());
      await change({ service, id, acting });

      expect(expectOk(await service.listMine(asking, {})).items).toEqual([]);
    });

    it('walks the invites a page at a time', async () => {
      const { repositories, service, invite } = await setup();
      expectOk(await invite());
      const second = expectOk(
        await repositories.channels.create({
          userId: STRANGER.id,
          handle: 'bob',
          displayName: 'Bob',
        })
      );
      expectOk(
        await repositories.channelInvites.create(
          {
            id: '00000000-0000-7000-8000-0000000017b1',
            channelId: second.id,
            inviteeUserId: INVITEE.id,
            role: 'analytics',
            invitedBy: STRANGER.id,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
          {
            channelId: second.id,
            actorUserId: STRANGER.id,
            action: 'invite.created',
            targetType: 'invite',
            targetId: '00000000-0000-7000-8000-0000000017b1',
            meta: { inviteeUserId: INVITEE.id, role: 'analytics' },
          }
        )
      );

      const first = expectOk(await service.listMine(INVITEE, { limit: 1 }));
      expect(first.items).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();

      const rest = expectOk(
        await service.listMine(INVITEE, { limit: 1, cursor: first.nextCursor ?? undefined })
      );
      expect(rest.items).toHaveLength(1);
      expect(rest.items[0]?.id).not.toBe(first.items[0]?.id);
      expect(rest.nextCursor).toBeNull();
    });

    it('refuses a cursor it did not issue', async () => {
      const { service } = await setup();

      expect(expectErr(await service.listMine(INVITEE, { cursor: 'nonsense' })).code).toBe(
        ErrorCodes.INVALID_CURSOR
      );
    });
  });
});
