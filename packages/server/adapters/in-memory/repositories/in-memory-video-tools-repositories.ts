import type { Container } from '@kit/composition';
import type { InMemoryEntityRevisionRepository } from './in-memory-entity-revision-repository';
import { Repo } from './in-memory-repo-tokens';
import type { InMemoryShareLinkRepository } from './in-memory-share-link-repository';
import type { InMemoryVideoChapterRepository } from './in-memory-video-chapter-repository';
import type { InMemoryVideoCorrectionRepository } from './in-memory-video-correction-repository';
import type { InMemoryVideoExperimentRepository } from './in-memory-video-experiment-repository';
import type { InMemoryVideoGenerationRepository } from './in-memory-video-generation-repository';
import type { InMemoryVideoPasswordRepository } from './in-memory-video-password-repository';
import type { InMemoryVideoThreadRepository } from './in-memory-video-thread-repository';
import { InMemoryWatchPartyRepositories } from './in-memory-watch-party-repositories';

export class InMemoryVideoToolsRepositories extends InMemoryWatchPartyRepositories {
  readonly entityRevisions: InMemoryEntityRevisionRepository;
  readonly videoChapters: InMemoryVideoChapterRepository;
  readonly videoCorrections: InMemoryVideoCorrectionRepository;
  readonly shareLinks: InMemoryShareLinkRepository;
  readonly videoPasswords: InMemoryVideoPasswordRepository;
  readonly videoExperiments: InMemoryVideoExperimentRepository;
  readonly videoGenerations: InMemoryVideoGenerationRepository;
  readonly videoThreads: InMemoryVideoThreadRepository;

  constructor(c: Container) {
    super(c.get(Repo.outbox), c.get(Repo.userEvents));
    this.entityRevisions = c.get(Repo.entityRevisions);
    this.videoChapters = c.get(Repo.videoChapters);
    this.videoCorrections = c.get(Repo.videoCorrections);
    this.shareLinks = c.get(Repo.shareLinks);
    this.videoPasswords = c.get(Repo.videoPasswords);
    this.videoExperiments = c.get(Repo.videoExperiments);
    this.videoGenerations = c.get(Repo.videoGenerations);
    this.videoThreads = c.get(Repo.videoThreads);
  }
}
