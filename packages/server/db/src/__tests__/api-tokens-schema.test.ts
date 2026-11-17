import { getTableConfig } from 'drizzle-orm/pg-core';
import { apiTokenUsage, apiTokens } from '../api-tokens-schema';
import { channelAuditLog } from '../channel-team-schema';
import { referenceFrom } from './foreign-key';

describe('db: api tokens schema', () => {
  it.each([
    { table: apiTokens, column: 'user_id', expected: { table: 'users', onDelete: 'cascade' } },
    {
      table: apiTokens,
      column: 'channel_id',
      expected: { table: 'channels', onDelete: 'cascade' },
    },
    {
      table: apiTokenUsage,
      column: 'token_id',
      expected: { table: 'api_tokens', onDelete: 'cascade' },
    },
    {
      table: channelAuditLog,
      column: 'actor_token_id',
      expected: { table: 'api_tokens', onDelete: 'set null' },
    },
  ])('references $expected.table from $column', ({ table, column, expected }) => {
    expect(referenceFrom(table, column)).toEqual(expected);
  });

  it('guards the name, the prefix and the scopes in the database', () => {
    expect(
      getTableConfig(apiTokens)
        .checks.map((constraint) => constraint.name)
        .sort()
    ).toEqual(['api_tokens_name_check', 'api_tokens_prefix_check', 'api_tokens_scopes_check']);
  });

  it('finds a token by its prefix and lists a user newest first', () => {
    expect(getTableConfig(apiTokens).indexes.map((index) => index.config.name)).toEqual([
      'api_tokens_prefix_idx',
      'api_tokens_user_newest_idx',
    ]);
  });

  it('counts requests once per token and day', () => {
    expect(
      getTableConfig(apiTokenUsage).primaryKeys[0]?.columns.map((column) => column.name)
    ).toEqual(['token_id', 'day']);
  });
});
