import { getTableConfig } from 'drizzle-orm/pg-core';
import { userEvents } from '../user-events-schema';
import { referenceFrom } from './foreign-key';

describe('db: user events schema', () => {
  it("drops a user's events with the user", () => {
    expect(referenceFrom(userEvents, 'user_id')).toEqual({ table: 'users', onDelete: 'cascade' });
  });

  it('indexes the replay by user and id, and the retention by age', () => {
    expect(getTableConfig(userEvents).indexes.map((index) => index.config.name)).toEqual([
      'user_events_user_idx',
      'user_events_created_at_idx',
    ]);
  });
});
