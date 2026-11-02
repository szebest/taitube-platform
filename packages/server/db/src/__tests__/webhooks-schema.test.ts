import { getTableConfig } from 'drizzle-orm/pg-core';
import { webhooks } from '../webhooks-schema';
import { referenceFrom } from './foreign-key';

describe('db: webhooks schema', () => {
  it('lets a deleted user take their webhooks', () => {
    expect(referenceFrom(webhooks, 'owner_id')).toEqual({ table: 'users', onDelete: 'cascade' });
  });

  it('guards the url length and the event list in the database', () => {
    expect(
      getTableConfig(webhooks)
        .checks.map((constraint) => constraint.name)
        .sort()
    ).toEqual(['webhooks_events_check', 'webhooks_url_check']);
  });

  it('indexes a user own webhooks in creation order', () => {
    expect(getTableConfig(webhooks).indexes.map((index) => index.config.name)).toContain(
      'webhooks_owner_created_idx'
    );
  });
});
