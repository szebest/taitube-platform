import type { Container } from '@kit/composition';
import type { Clock } from './clock';
import { InMemoryAccountAuditRepository } from './in-memory-account-audit-repository';
import { InMemoryApiTokenRepository } from './in-memory-api-token-repository';
import { InMemoryDataExportRepository } from './in-memory-data-export-repository';
import { InMemoryExportRowRepository } from './in-memory-export-row-repository';
import { Repo } from './in-memory-repo-tokens';

/** The repositories of the account's data and API surface: exports, personal access tokens and its own audit log. */
export function provideExports(container: Container, now: Clock): Container {
  return container
    .provide(
      Repo.dataExports,
      (c) =>
        new InMemoryDataExportRepository({
          audit: c.get(Repo.channelAudit),
          outbox: c.get(Repo.outbox),
          userEvents: c.get(Repo.userEvents),
          now,
        })
    )
    .provide(Repo.apiTokens, (c) => new InMemoryApiTokenRepository(c.get(Repo.users)))
    .provide(Repo.accountAudit, () => new InMemoryAccountAuditRepository());
}

/** A read-only view over the stores the export kinds read; it holds nothing of its own to clear. */
function exportRowsOver(c: Container): InMemoryExportRowRepository {
  return new InMemoryExportRowRepository({
    videos: c.get(Repo.videos),
    views: c.get(Repo.videoViews),
    comments: c.get(Repo.comments),
    channels: c.get(Repo.channels),
    subscriptions: c.get(Repo.subscriptions),
    categories: c.get(Repo.categories),
    posts: c.get(Repo.channelPosts),
  });
}

/** The account's data repositories as `InMemoryRepositories` exposes them. */
export function accountDataOf(c: Container) {
  return {
    dataExports: c.get(Repo.dataExports),
    apiTokens: c.get(Repo.apiTokens),
    accountAudit: c.get(Repo.accountAudit),
    exportRows: exportRowsOver(c),
  };
}

export type AccountDataRepositories = ReturnType<typeof accountDataOf>;
