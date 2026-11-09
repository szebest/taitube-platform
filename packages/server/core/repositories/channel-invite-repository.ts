import type { ChannelInvite, ChannelMembership, NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export type NewChannelInvite = Omit<ChannelInvite, 'status' | 'createdAt'>;

export type CreateInviteOutcome =
  | { type: 'created'; invite: ChannelInvite }
  | { type: 'already-pending' };

export type AcceptInviteOutcome =
  | { type: 'accepted'; membership: ChannelMembership }
  | { type: 'not-pending' };

export interface PendingInvitesQuery {
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
}

/**
 * Invites expire lazily: a `pending` row past `expiresAt` reads as `expired` and can be neither
 * accepted nor closed. Every transition is a compare-and-set from `pending` that writes its audit
 * entry in the same transaction; a lost race answers, it does not fail.
 */
export interface ChannelInviteRepositoryPort {
  /** One pending invite per channel and invitee; an expired one is closed first, so it does not block. */
  create(
    invite: NewChannelInvite,
    audit: NewChannelAuditEntry
  ): Promise<Result<CreateInviteOutcome, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<ChannelInvite | null, DatabaseUnavailable>>;
  /** Pending and unexpired, oldest first. */
  listPending(channelId: string): Promise<Result<ChannelInvite[], DatabaseUnavailable>>;
  /** The invitee's pending and unexpired invites across channels, newest first, up to `limit + 1` rows. */
  listPendingFor(
    inviteeUserId: string,
    query: PendingInvitesQuery
  ): Promise<Result<ChannelInvite[], DatabaseUnavailable>>;
  /** The invitee's own pending invite becomes a membership; an existing membership is kept as it is. */
  accept(
    id: string,
    inviteeUserId: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<AcceptInviteOutcome, DatabaseUnavailable>>;
  /** `false` when the invite is not pending any more. */
  close(
    id: string,
    status: 'declined' | 'revoked',
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}
