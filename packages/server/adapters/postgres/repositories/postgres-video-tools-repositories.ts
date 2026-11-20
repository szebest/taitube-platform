import { PostgresEntityRevisionRepository } from './postgres-entity-revision-repository';
import { PostgresShareLinkRepository } from './postgres-share-link-repository';
import { PostgresVideoChapterRepository } from './postgres-video-chapter-repository';
import { PostgresVideoCorrectionRepository } from './postgres-video-correction-repository';
import { PostgresVideoExperimentRepository } from './postgres-video-experiment-repository';
import { PostgresVideoPasswordRepository } from './postgres-video-password-repository';
import type { PostgresDatabase } from './types';

/** Revisions, chapters, corrections, share links, passwords and experiments: the repositories behind a creator's video tools. */
export abstract class PostgresVideoToolsRepositories {
  readonly entityRevisions: PostgresEntityRevisionRepository;
  readonly videoChapters: PostgresVideoChapterRepository;
  readonly videoCorrections: PostgresVideoCorrectionRepository;
  readonly shareLinks: PostgresShareLinkRepository;
  readonly videoPasswords: PostgresVideoPasswordRepository;
  readonly videoExperiments: PostgresVideoExperimentRepository;

  constructor(db: PostgresDatabase) {
    this.entityRevisions = new PostgresEntityRevisionRepository(db);
    this.videoChapters = new PostgresVideoChapterRepository(db);
    this.videoCorrections = new PostgresVideoCorrectionRepository(db);
    this.shareLinks = new PostgresShareLinkRepository(db);
    this.videoPasswords = new PostgresVideoPasswordRepository(db);
    this.videoExperiments = new PostgresVideoExperimentRepository(db);
  }
}
