import type { NewChannelInvite, Repositories } from '@vp/core/repositories';
import type { Channel, NewChannelAuditEntry } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID } from './fixtures';

export const INVITEE_ID = '00000000-0000-7000-8000-000000000103';

const DAY_MS = 86_400_000;

export const inviteId = (n: number) =>
  `00000000-0000-7000-8000-00000000c1${String(n).padStart(2, '0')}`;

export async function seedTeam(repositories: Repositories): Promise<Channel> {
  expectOk(
    await repositories.users.upsert({ id: INVITEE_ID, email: 'invitee@video-pipeline.local' })
  );
  return expectOk(
    await repositories.channels.create({ userId: OWNER_ID, handle: 'owner', displayName: 'Owner' })
  );
}

export function invite(
  channel: Channel,
  n: number,
  overrides: Partial<NewChannelInvite> = {}
): NewChannelInvite {
  return {
    id: inviteId(n),
    channelId: channel.id,
    inviteeUserId: INVITEE_ID,
    role: 'editor',
    invitedBy: OWNER_ID,
    expiresAt: new Date(Date.now() + 14 * DAY_MS),
    ...overrides,
  };
}

export const expired = { expiresAt: new Date(Date.now() - DAY_MS) };

export function auditOf(
  channel: Channel,
  action: 'invite.created' | 'invite.accepted' | 'invite.declined' | 'invite.revoked',
  n: number,
  actorUserId = OWNER_ID
): NewChannelAuditEntry {
  return {
    channelId: channel.id,
    actorUserId,
    action,
    targetType: 'invite',
    targetId: inviteId(n),
    meta: { inviteeUserId: INVITEE_ID, role: 'editor' },
  };
}

export function memberAudit(
  channel: Channel,
  action: 'member.removed' | 'member.left',
  actorUserId = OTHER_OWNER_ID
): NewChannelAuditEntry {
  return {
    channelId: channel.id,
    actorUserId,
    action,
    targetType: 'member',
    targetId: INVITEE_ID,
    meta: { role: 'editor' },
  };
}

/** A membership exists only through an accepted invite. */
export async function seedMember(
  repositories: Repositories,
  channel: Channel,
  n = 90
): Promise<void> {
  expectOk(
    await repositories.channelInvites.create(
      invite(channel, n),
      auditOf(channel, 'invite.created', n)
    )
  );
  expectOk(
    await repositories.channelInvites.accept(
      inviteId(n),
      INVITEE_ID,
      auditOf(channel, 'invite.accepted', n, INVITEE_ID)
    )
  );
}
