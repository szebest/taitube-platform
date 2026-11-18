import { getTableConfig } from 'drizzle-orm/pg-core';
import { entityRevisions, videoChapters, videoCorrections } from '../video-tools-schema';
import { referenceFrom } from './foreign-key';

describe('db: video tools schema', () => {
  it.each([
    {
      scenario: 'a purged video takes its chapters',
      table: videoChapters,
      column: 'video_id',
      target: 'videos',
      onDelete: 'cascade',
    },
    {
      scenario: 'a purged video takes its corrections',
      table: videoCorrections,
      column: 'video_id',
      target: 'videos',
      onDelete: 'cascade',
    },
    {
      scenario: 'a deleted author keeps the revision',
      table: entityRevisions,
      column: 'author_user_id',
      target: 'users',
      onDelete: 'set null',
    },
  ])('$scenario', ({ table, column, target, onDelete }) => {
    expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
  });

  it.each([
    {
      table: entityRevisions,
      checks: ['entity_revisions_type_check', 'entity_revisions_note_check'],
    },
    { table: videoChapters, checks: ['video_chapters_start_check', 'video_chapters_title_check'] },
    {
      table: videoCorrections,
      checks: ['video_corrections_range_check', 'video_corrections_text_check'],
    },
  ])('guards the limits of $table in the database', ({ table, checks }) => {
    expect(getTableConfig(table).checks.map((constraint) => constraint.name)).toEqual(checks);
  });

  it('keeps one revision per entity and version', () => {
    const [index] = getTableConfig(entityRevisions).indexes;

    expect(index?.config).toMatchObject({
      name: 'entity_revisions_entity_version_idx',
      unique: true,
    });
  });

  it('keys a chapter by its video and position', () => {
    const [key] = getTableConfig(videoChapters).primaryKeys;

    expect(key?.columns.map((column) => column.name)).toEqual(['video_id', 'position']);
  });
});
