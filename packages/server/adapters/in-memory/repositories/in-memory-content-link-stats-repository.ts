import { isOk, ok, type Result } from '@kit/result';
import type {
  ContentLinkDayCounts,
  ContentLinkStatCounts,
  ContentLinkRepositoryPort,
  ContentLinkStatsRepositoryPort,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';

export class InMemoryContentLinkStatsRepository implements ContentLinkStatsRepositoryPort {
  private readonly days = new Map<string, ContentLinkDayCounts>();

  constructor(private readonly links: Pick<ContentLinkRepositoryPort, 'findById'>) {}

  async addDaily(
    counts: readonly ContentLinkDayCounts[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    for (const count of counts) {
      const link = await this.links.findById(count.linkId);
      if (!isOk(link) || !link.value) continue;
      const key = `${count.linkId}:${count.day}`;
      const held = this.days.get(key);
      this.days.set(key, {
        ...count,
        impressions: (held?.impressions ?? 0) + count.impressions,
        clicks: (held?.clicks ?? 0) + count.clicks,
        watchSeconds: (held?.watchSeconds ?? 0) + count.watchSeconds,
      });
    }
    return ok();
  }

  async totalsFor(
    linkIds: readonly string[]
  ): Promise<Result<Map<string, ContentLinkStatCounts>, DatabaseUnavailable>> {
    const totals = new Map<string, ContentLinkStatCounts>(
      linkIds.map((id) => [id, { impressions: 0, clicks: 0, watchSeconds: 0 }])
    );
    for (const day of this.days.values()) {
      const total = totals.get(day.linkId);
      if (!total) continue;
      total.impressions += day.impressions;
      total.clicks += day.clicks;
      total.watchSeconds += day.watchSeconds;
    }
    return ok(totals);
  }

  clear(): void {
    this.days.clear();
  }
}
