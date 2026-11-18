import { PostgresEntityRevisionRepository } from '../postgres-entity-revision-repository';
import { PostgresVideoChapterRepository } from '../postgres-video-chapter-repository';
import { PostgresVideoCorrectionRepository } from '../postgres-video-correction-repository';
import { PostgresVideoToolsRepositories } from '../postgres-video-tools-repositories';
import type { PostgresDatabase } from '../types';

class Tools extends PostgresVideoToolsRepositories {}

describe('PostgresVideoToolsRepositories', () => {
  it('builds the revision, chapter and correction repositories over the handle it is given', () => {
    const tools = new Tools({} as PostgresDatabase);

    expect(tools.entityRevisions).toBeInstanceOf(PostgresEntityRevisionRepository);
    expect(tools.videoChapters).toBeInstanceOf(PostgresVideoChapterRepository);
    expect(tools.videoCorrections).toBeInstanceOf(PostgresVideoCorrectionRepository);
  });
});
