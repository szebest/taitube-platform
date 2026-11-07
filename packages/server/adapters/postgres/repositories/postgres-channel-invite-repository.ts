import type {
  AcceptInviteOutcome,
  ChannelInviteRepositoryPort,
  CreateInviteOutcome,
  NewChannelInvite,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ChannelInvite, NewChannelAuditEntry } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { teamInviteOutbox } from '@vp/job-contracts';
import { fromPromise, type Result } from '@vp/result';
import { and, asc, eq, gt, lte, sql } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import { enqueueNotificationJobs } from './notification-jobs';
import type { PostgresDatabase } from './types';

const { channelInvites: i, channelMembers: m } = schema;

type InviteRow = typeof i.$inferSelect;

function asRead(row: InviteRow): ChannelInvite {
  return row.status === 'pending' && row.expiresAt.getTime() <= Date.now()
    ? { ...row, status: 'expired' }
    : row;
}

const livePending = (id: string) =>
  and(eq(i.id, id), eq(i.status, 'pending'), gt(i.expiresAt, sql`now()`));

export class PostgresChannelInviteRepository implements ChannelInviteRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(
    invite: NewChannelInvite,
    audit: NewChannelAuditEntry
  ): Promise<Result<CreateInviteOutcome, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<CreateInviteOutcome> => {
          await tx
            .update(i)
            .set({ status: 'expired' })
            .where(
              and(
                eq(i.channelId, invite.channelId),
                eq(i.inviteeUserId, invite.inviteeUserId),
                eq(i.status, 'pending'),
                lte(i.expiresAt, sql`now()`)
              )
            );

          const [created] = await tx
            .insert(i)
            .values(invite)
            .onConflictDoNothing({
              target: [i.channelId, i.inviteeUserId],
              where: sql`${i.status} = 'pending'`,
            })
            .returning();
          if (!created) return { type: 'already-pending' };

          await appendChannelAudit(tx, audit);
          await enqueueNotificationJobs(tx, [teamInviteOutbox({ inviteId: created.id })]);
          return { type: 'created', invite: created };
        }),
      databaseUnavailable.during('createChannelInvite')
    );
  }

  async findById(id: string): Promise<Result<ChannelInvite | null, DatabaseUnavailable>> {
    return fromPromise(async () => {
      const [found] = await this.db.select().from(i).where(eq(i.id, id)).limit(1);
      return found ? asRead(found) : null;
    }, databaseUnavailable.during('findChannelInvite'));
  }

  async listPending(channelId: string): Promise<Result<ChannelInvite[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(i)
          .where(
            and(eq(i.channelId, channelId), eq(i.status, 'pending'), gt(i.expiresAt, sql`now()`))
          )
          .orderBy(asc(i.createdAt), asc(i.id)),
      databaseUnavailable.during('listPendingChannelInvites')
    );
  }

  async accept(
    id: string,
    inviteeUserId: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<AcceptInviteOutcome, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<AcceptInviteOutcome> => {
          const [accepted] = await tx
            .update(i)
            .set({ status: 'accepted' })
            .where(and(livePending(id), eq(i.inviteeUserId, inviteeUserId)))
            .returning();
          if (!accepted) return { type: 'not-pending' };

          await tx
            .insert(m)
            .values({
              channelId: accepted.channelId,
              userId: inviteeUserId,
              role: accepted.role,
              invitedBy: accepted.invitedBy,
            })
            .onConflictDoNothing();
          const [membership] = await tx
            .select()
            .from(m)
            .where(and(eq(m.channelId, accepted.channelId), eq(m.userId, inviteeUserId)));
          if (!membership)
            throw new Error(`membership of invite ${id} vanished in its transaction`);

          await appendChannelAudit(tx, audit);
          return { type: 'accepted', membership };
        }),
      databaseUnavailable.during('acceptChannelInvite')
    );
  }

  async close(
    id: string,
    status: 'declined' | 'revoked',
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [closed] = await tx
            .update(i)
            .set({ status })
            .where(livePending(id))
            .returning({ id: i.id });
          if (!closed) return false;

          await appendChannelAudit(tx, audit);
          return true;
        }),
      databaseUnavailable.during('closeChannelInvite')
    );
  }
}
