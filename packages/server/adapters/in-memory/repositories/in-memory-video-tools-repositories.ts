import type { Container } from '@kit/composition';
import type { InMemoryEntityRevisionRepository } from './in-memory-entity-revision-repository';
import { Repo } from './in-memory-repo-tokens';
import type { InMemoryVideoChapterRepository } from './in-memory-video-chapter-repository';
import type { InMemoryVideoCorrectionRepository } from './in-memory-video-correction-repository';
import { InMemoryWatchPartyRepositories } from './in-memory-watch-party-repositories';

export class InMemoryVideoToolsRepositories extends InMemoryWatchPartyRepositories {
  readonly entityRevisions: InMemoryEntityRevisionRepository;
  readonly videoChapters: InMemoryVideoChapterRepository;
  readonly videoCorrections: InMemoryVideoCorrectionRepository;

  constructor(c: Container) {
    super(c.get(Repo.outbox), c.get(Repo.userEvents));
    this.entityRevisions = c.get(Repo.entityRevisions);
    this.videoChapters = c.get(Repo.videoChapters);
    this.videoCorrections = c.get(Repo.videoCorrections);
  }
}
