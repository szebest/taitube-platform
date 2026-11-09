import type {
  AcceptInviteOutcome,
  ChannelInviteRepositoryPort,
  CreateInviteOutcome,
  NewChannelInvite,
  OutboxRepository,
  PendingInvitesQuery,
} from '@vp/core/repositories';
import { type ChannelInvite, type NewChannelAuditEntry, roleHas } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { teamInviteOutbox } from '@vp/job-contracts';
import { isErr, map, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelMemberRepository } from './in-memory-channel-member-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const isLivePending = (invite: ChannelInvite) =>
  invite.status === 'pending' && invite.expiresAt.getTime() > Date.now();

const asRead = (invite: ChannelInvite): ChannelInvite =>
  invite.status === 'pending' && !isLivePending(invite)
    ? { ...invite, status: 'expired' }
    : { ...invite };

export interface InMemoryChannelInviteRepositoryOptions {
  members: Pick<InMemoryChannelMemberRepository, 'join' | 'roleOf'>;
  channels: Pick<InMemoryChannelRepository, 'findById'>;
  audit: Pick<InMemoryChannelAuditRepository, 'append'>;
  outbox: Pick<OutboxRepository, 'enqueue'>;
}

export class InMemoryChannelInviteRepository implements ChannelInviteRepositoryPort {
  private readonly rows = new Map<string, ChannelInvite>();

  constructor(private readonly deps: InMemoryChannelInviteRepositoryOptions) {}

  async create(
    invite: NewChannelInvite,
    audit: NewChannelAuditEntry
  ): Promise<Result<CreateInviteOutcome, DatabaseUnavailable>> {
    for (const row of this.rows.values()) {
      if (
        row.channelId !== invite.channelId ||
        row.inviteeUserId !== invite.inviteeUserId ||
        row.status !== 'pending'
      ) {
        continue;
      }
      if (isLivePending(row)) return ok({ type: 'already-pending' });
      row.status = 'expired';
    }

    const created: ChannelInvite = { ...invite, status: 'pending', createdAt: new Date() };
    this.rows.set(created.id, created);
    const audited = await this.deps.audit.append(audit);
    if (isErr(audited)) return audited;
    return map(await this.deps.outbox.enqueue(teamInviteOutbox({ inviteId: created.id })), () => ({
      type: 'created' as const,
      invite: { ...created },
    }));
  }

  async findById(id: string): Promise<Result<ChannelInvite | null, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    return ok(found ? asRead(found) : null);
  }

  async listPending(channelId: string): Promise<Result<ChannelInvite[], DatabaseUnavailable>> {
    return ok(
      [...this.rows.values()]
        .filter((row) => row.channelId === channelId && isLivePending(row))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((row) => ({ ...row }))
    );
  }

  async listPendingFor(
    inviteeUserId: string,
    { cursor, limit }: PendingInvitesQuery
  ): Promise<Result<ChannelInvite[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    return ok(
      [...this.rows.values()]
        .filter((row) => row.inviteeUserId === inviteeUserId && isLivePending(row))
        .filter((row) => isKeysetBefore({ sort: row.createdAt, tie: row.id }, after))
        .sort((a, b) =>
          byKeysetDesc({ sort: a.createdAt, tie: a.id }, { sort: b.createdAt, tie: b.id })
        )
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  async accept(
    id: string,
    inviteeUserId: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<AcceptInviteOutcome, DatabaseUnavailable>> {
    const invite = this.rows.get(id);
    if (!(invite && isLivePending(invite) && invite.inviteeUserId === inviteeUserId)) {
      return ok({ type: 'not-pending' });
    }
    const manages = await this.inviterStillManages(invite);
    if (isErr(manages)) return manages;
    if (!manages.value) return ok({ type: 'not-pending' });

    invite.status = 'accepted';
    const membership = this.deps.members.join({
      channelId: invite.channelId,
      userId: inviteeUserId,
      role: invite.role,
      invitedBy: invite.invitedBy,
      createdAt: new Date(),
    });
    return map(await this.deps.audit.append(audit), () => ({
      type: 'accepted' as const,
      membership,
    }));
  }

  async close(
    id: string,
    status: 'declined' | 'revoked',
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const invite = this.rows.get(id);
    if (!(invite && isLivePending(invite))) return ok(false);

    invite.status = status;
    return map(await this.deps.audit.append(audit), () => true);
  }

  /** The live invites `inviterId` sent on the channel become revoked, one audit row each. */
  async revokeSentBy({
    channelId,
    inviterId,
    actorUserId,
  }: {
    channelId: string;
    inviterId: string;
    actorUserId: string;
  }): Promise<Result<void, DatabaseUnavailable>> {
    for (const invite of this.rows.values()) {
      if (invite.channelId !== channelId || invite.invitedBy !== inviterId) continue;
      if (!isLivePending(invite)) continue;
      invite.status = 'revoked';
      const { id, inviteeUserId, role } = invite;
      const audited = await this.deps.audit.append({
        channelId,
        actorUserId,
        action: 'invite.revoked',
        targetType: 'invite',
        targetId: id,
        meta: { inviteeUserId, role },
      });
      if (isErr(audited)) return audited;
    }
    return ok();
  }

  private async inviterStillManages({
    channelId,
    invitedBy,
  }: ChannelInvite): Promise<Result<boolean, DatabaseUnavailable>> {
    if (invitedBy === null) return ok(false);
    return map(await this.deps.channels.findById(channelId), (channel) => {
      if (channel?.userId === invitedBy) return true;
      const role = this.deps.members.roleOf(channelId, invitedBy);
      return role !== undefined && roleHas(role, 'team.manage');
    });
  }

  clear(): void {
    this.rows.clear();
  }
}
