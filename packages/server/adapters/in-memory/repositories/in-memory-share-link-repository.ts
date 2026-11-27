import type { DatabaseUnavailable } from '@kit/errors';
import { ok, type Result } from '@kit/result';
import { ShareLinkRepository } from '@vp/core/repositories';
import {
  mergeShareLinkCounts,
  NO_SHARE_LINK_TOTALS,
  type ShareLink,
  type ShareLinkCount,
  type ShareLinkTargetType,
  type ShareLinkTotals,
} from '@vp/domain';

function isActiveAt(link: ShareLink, at: Date): boolean {
  return link.revokedAt === null && (link.expiresAt === null || link.expiresAt > at);
}

export class InMemoryShareLinkRepository extends ShareLinkRepository {
  private readonly links = new Map<string, ShareLink>();
  private readonly stats = new Map<string, ShareLinkCount>();

  async listFor(
    targetType: ShareLinkTargetType,
    targetId: string
  ): Promise<Result<ShareLink[], DatabaseUnavailable>> {
    return ok(
      [...this.links.values()]
        .filter((link) => link.targetType === targetType && link.targetId === targetId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        .map((link) => ({ ...link }))
    );
  }

  async create(link: ShareLink, limit: number): Promise<Result<boolean, DatabaseUnavailable>> {
    const active = [...this.links.values()].filter(
      (held) =>
        held.targetType === link.targetType &&
        held.targetId === link.targetId &&
        isActiveAt(held, link.createdAt)
    );
    if (active.length >= limit) return ok(false);
    this.links.set(link.id, { ...link });
    return ok(true);
  }

  async findByToken(token: string): Promise<Result<ShareLink | null, DatabaseUnavailable>> {
    const found = [...this.links.values()].find((link) => link.token === token);
    return ok(found ? { ...found } : null);
  }

  async revoke(
    targetType: ShareLinkTargetType,
    targetId: string,
    linkId: string,
    at: Date
  ): Promise<Result<ShareLink | null, DatabaseUnavailable>> {
    const found = this.links.get(linkId);
    if (found?.targetType !== targetType || found.targetId !== targetId) return ok(null);
    const revoked = { ...found, revokedAt: found.revokedAt ?? at };
    this.links.set(linkId, revoked);
    return ok({ ...revoked });
  }

  async totalsFor(
    linkIds: readonly string[]
  ): Promise<Result<Map<string, ShareLinkTotals>, DatabaseUnavailable>> {
    const totals = new Map<string, ShareLinkTotals>(
      linkIds.map((id) => [id, NO_SHARE_LINK_TOTALS])
    );
    for (const row of this.stats.values()) {
      const held = totals.get(row.linkId);
      if (!held) continue;
      totals.set(row.linkId, {
        opens: held.opens + row.opens,
        views: held.views + row.views,
        watchSeconds: held.watchSeconds + row.watchSeconds,
      });
    }
    return ok(totals);
  }

  /** What a flush adds to `share_link_stats`; a link that is not here is skipped, as its foreign key does. */
  addStats(counts: readonly ShareLinkCount[]): void {
    for (const count of mergeShareLinkCounts(counts)) {
      if (!this.links.has(count.linkId)) continue;
      const key = `${count.linkId}|${count.viewDate}`;
      const held = this.stats.get(key);
      this.stats.set(key, {
        ...count,
        opens: count.opens + (held?.opens ?? 0),
        views: count.views + (held?.views ?? 0),
        watchSeconds: count.watchSeconds + (held?.watchSeconds ?? 0),
      });
    }
  }

  clear(): void {
    this.links.clear();
    this.stats.clear();
  }
}
