import { getTableConfig } from 'drizzle-orm/pg-core';
import { clips } from '../clips-schema';
import { referenceFrom } from './foreign-key';

describe('db: clips schema', () => {
  it.each([
    { scenario: 'a purged video takes its clips', column: 'video_id', target: 'videos' },
    { scenario: 'a deleted user takes their clips', column: 'user_id', target: 'users' },
  ])('$scenario', ({ column, target }) => {
    expect(referenceFrom(clips, column)).toEqual({ table: target, onDelete: 'cascade' });
  });

  it('guards the range and its length in the database', () => {
    expect(getTableConfig(clips).checks.map((constraint) => constraint.name)).toEqual([
      'clips_range_check',
    ]);
  });

  it.each(['clips_user_created_idx', 'clips_video_idx'])('indexes %s', (name) => {
    expect(getTableConfig(clips).indexes.map((index) => index.config.name)).toContain(name);
  });
});
