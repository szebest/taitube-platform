import type { Container } from '@vp/composition';
import type { Clock } from './clock';
import { InMemoryDataExportRepository } from './in-memory-data-export-repository';
import { Repo } from './in-memory-repo-tokens';

export function provideExports(container: Container, now: Clock): Container {
  return container.provide(
    Repo.dataExports,
    (c) =>
      new InMemoryDataExportRepository({
        audit: c.get(Repo.channelAudit),
        outbox: c.get(Repo.outbox),
        userEvents: c.get(Repo.userEvents),
        now,
      })
  );
}
