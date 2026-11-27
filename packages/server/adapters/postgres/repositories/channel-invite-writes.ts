import * as schema from '@vp/db';
import { and, eq, gt, sql } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import type { PostgresDatabase } from './types';

const { channelInvites: i } = schema;

export interface SentInvites {
  channelId: string;
  inviterId: string;
  /** Who removed or demoted the inviter: the inviter themselves when they left. */
  actorUserId: string;
}

/**
 * Revokes the live invites `inviterId` sent on the channel, one `invite.revoked` row each, on the
 * caller's transaction: someone who no longer runs the team cannot still bring people onto it.
 */
export async function revokeInvitesSentBy(
  tx: PostgresDatabase,
  { channelId, inviterId, actorUserId }: SentInvites
): Promise<void> {
  const revoked = await tx
    .update(i)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(i.channelId, channelId),
        eq(i.invitedBy, inviterId),
        eq(i.status, 'pending'),
        gt(i.expiresAt, sql`now()`)
      )
    )
    .returning();

  for (const { id, inviteeUserId, role } of revoked) {
    await appendChannelAudit(tx, {
      channelId,
      actorUserId,
      action: 'invite.revoked',
      targetType: 'invite',
      targetId: id,
      meta: { inviteeUserId, role },
    });
  }
}
