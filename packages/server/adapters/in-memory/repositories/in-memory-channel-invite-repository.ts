import type {
  AcceptInviteOutcome,
  ChannelInviteRepositoryPort,
  CreateInviteOutcome,
  NewChannelInvite,
} from '@vp/core/repositories';
import type { ChannelInvite, NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { map, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelMemberRepository } from './in-memory-channel-member-repository';

const isLivePending = (invite: ChannelInvite) =>
  invite.status === 'pending' && invite.expiresAt.getTime() > Date.now();

const asRead = (invite: ChannelInvite): ChannelInvite =>
  invite.status === 'pending' && !isLivePending(invite)
    ? { ...invite, status: 'expired' }
    : { ...invite };

export interface InMemoryChannelInviteRepositoryOptions {
  members: Pick<InMemoryChannelMemberRepository, 'join'>;
  audit: Pick<InMemoryChannelAuditRepository, 'append'>;
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
    return map(await this.deps.audit.append(audit), () => ({
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

  async accept(
    id: string,
    inviteeUserId: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<AcceptInviteOutcome, DatabaseUnavailable>> {
    const invite = this.rows.get(id);
    if (!(invite && isLivePending(invite) && invite.inviteeUserId === inviteeUserId)) {
      return ok({ type: 'not-pending' });
    }

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

  clear(): void {
    this.rows.clear();
  }
}
