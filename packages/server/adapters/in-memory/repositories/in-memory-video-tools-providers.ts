import type { Container } from '@kit/composition';
import { type Clock, realClock } from './clock';
import { InMemoryEntityRevisionRepository } from './in-memory-entity-revision-repository';
import { Repo } from './in-memory-repo-tokens';
import { InMemoryShareLinkRepository } from './in-memory-share-link-repository';
import { InMemoryVideoChapterRepository } from './in-memory-video-chapter-repository';
import { InMemoryVideoCorrectionRepository } from './in-memory-video-correction-repository';
import { InMemoryVideoExperimentRepository } from './in-memory-video-experiment-repository';
import { InMemoryVideoGenerationRepository } from './in-memory-video-generation-repository';
import { InMemoryVideoPasswordRepository } from './in-memory-video-password-repository';
import { InMemoryVideoStudioRepository } from './in-memory-video-studio-repository';

/** The studio repository with the revision, chapter and correction stores its edits write to, and the share link, password and experiment stores beside them. */
export function provideVideoTools(container: Container, now: Clock = realClock): Container {
  return container
    .provide(Repo.entityRevisions, () => new InMemoryEntityRevisionRepository(now))
    .provide(Repo.videoChapters, () => new InMemoryVideoChapterRepository())
    .provide(Repo.videoCorrections, () => new InMemoryVideoCorrectionRepository())
    .provide(Repo.shareLinks, () => new InMemoryShareLinkRepository())
    .provide(Repo.videoPasswords, (c) => new InMemoryVideoPasswordRepository(c.get(Repo.videos)))
    .provide(
      Repo.videoExperiments,
      (c) => new InMemoryVideoExperimentRepository(c.get(Repo.videos))
    )
    .provide(
      Repo.videoGenerations,
      (c) =>
        new InMemoryVideoGenerationRepository(
          {
            videos: c.get(Repo.videos),
            chapters: c.get(Repo.videoChapters),
            corrections: c.get(Repo.videoCorrections),
            retention: c.get(Repo.videoViews),
            events: c.get(Repo.events),
            userEvents: c.get(Repo.userEvents),
            outbox: c.get(Repo.outbox),
          },
          now
        )
    )
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
