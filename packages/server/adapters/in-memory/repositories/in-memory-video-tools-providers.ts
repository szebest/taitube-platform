import type { Container } from '@kit/composition';
import { type Clock, realClock } from './clock';
import { InMemoryEntityRevisionRepository } from './in-memory-entity-revision-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryVideoChapterRepository } from './in-memory-video-chapter-repository';
import { InMemoryVideoCorrectionRepository } from './in-memory-video-correction-repository';
import { InMemoryVideoStudioRepository } from './in-memory-video-studio-repository';

/** The studio repository with the revision, chapter and correction stores its edits write to. */
export function provideVideoTools(container: Container, now: Clock = realClock): Container {
  return container
    .provide(Repo.entityRevisions, () => new InMemoryEntityRevisionRepository(now))
    .provide(Repo.videoChapters, () => new InMemoryVideoChapterRepository())
    .provide(Repo.videoCorrections, () => new InMemoryVideoCorrectionRepository())
    .provide(
      Repo.videoStudio,
      (c) =>
        new InMemoryVideoStudioRepository({
          videos: c.get(Repo.videos),
          categories: c.get(Repo.categories),
          events: c.get(Repo.events),
          outbox: c.get(Repo.outbox),
          channels: c.get(Repo.channels),
          audit: c.get(Repo.channelAudit),
          revisions: c.get(Repo.entityRevisions),
          chapters: c.get(Repo.videoChapters),
        })
    );
}
