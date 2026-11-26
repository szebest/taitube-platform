import type { Result } from '@kit/result';
import type { ShareLink, ShareLinkTargetType, ShareLinkTotals } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export abstract class ShareLinkRepository {
  /** Newest first, expired and revoked links included. */
  abstract listFor(
    targetType: ShareLinkTargetType,
    targetId: string
  ): Promise<Result<ShareLink[], DatabaseUnavailable>>;
  /**
   * `false` when the target already holds `limit` links active at `link.createdAt`, decided under
   * one lock with the insert, so two creators cannot pass the limit together.
   */
  abstract create(link: ShareLink, limit: number): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract findByToken(token: string): Promise<Result<ShareLink | null, DatabaseUnavailable>>;
  /** The revoked link, or `null` when the target holds none with that id; a second revoke keeps the first time. */
  abstract revoke(
    targetType: ShareLinkTargetType,
    targetId: string,
    linkId: string,
    at: Date
  ): Promise<Result<ShareLink | null, DatabaseUnavailable>>;
  /** Every flushed day added up; every id gets an entry, zero for a link nobody opened. */
  abstract totalsFor(
    linkIds: readonly string[]
  ): Promise<Result<Map<string, ShareLinkTotals>, DatabaseUnavailable>>;
}
