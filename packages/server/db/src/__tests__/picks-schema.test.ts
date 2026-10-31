import { getTableConfig } from 'drizzle-orm/pg-core';
import { picks } from '../picks-schema';
import { referenceFrom } from './foreign-key';

describe('db: picks schema', () => {
  it.each([
    { scenario: 'a purged video takes its picks', column: 'video_id', target: 'videos' },
    { scenario: 'a deleted editor takes their picks', column: 'created_by', target: 'users' },
  ])('$scenario', ({ column, target }) => {
    expect(referenceFrom(picks, column)).toEqual({ table: target, onDelete: 'cascade' });
  });

  it('guards the window and the note length in the database', () => {
    expect(
      getTableConfig(picks)
        .checks.map((constraint) => constraint.name)
        .sort()
    ).toEqual(['picks_note_check', 'picks_window_check']);
  });

  it.each(['picks_starts_at_idx', 'picks_video_idx'])('indexes %s', (name) => {
    expect(getTableConfig(picks).indexes.map((index) => index.config.name)).toContain(name);
  });
});
