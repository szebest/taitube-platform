import { PostgresEntityRevisionRepository } from './postgres-entity-revision-repository';
import { PostgresVideoChapterRepository } from './postgres-video-chapter-repository';
import { PostgresVideoCorrectionRepository } from './postgres-video-correction-repository';
import type { PostgresDatabase } from './types';

/** Revisions, chapters and corrections: the repositories behind a creator's video tools. */
export abstract class PostgresVideoToolsRepositories {
  readonly entityRevisions: PostgresEntityRevisionRepository;
  readonly videoChapters: PostgresVideoChapterRepository;
  readonly videoCorrections: PostgresVideoCorrectionRepository;

  constructor(db: PostgresDatabase) {
    this.entityRevisions = new PostgresEntityRevisionRepository(db);
    this.videoChapters = new PostgresVideoChapterRepository(db);
    this.videoCorrections = new PostgresVideoCorrectionRepository(db);
  }
}
