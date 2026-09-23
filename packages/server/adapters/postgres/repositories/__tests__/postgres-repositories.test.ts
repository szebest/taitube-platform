import type * as schema from '@vp/db';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { PostgresRepositories } from '../postgres-repositories';

const REPOSITORIES = [
  'videos',
  'uploads',
  'steps',
  'renditions',
  'events',
  'users',
  'dlq',
  'outbox',
  'categories',
  'channels',
  'videoReactions',
  'subscriptions',
] as const;

const db = {} as PostgresJsDatabase<typeof schema>;

describe('PostgresRepositories', () => {
  it('wires every repository over the drizzle handle it is given', () => {
    const repositories = new PostgresRepositories({ type: 'drizzle', db });

    for (const name of REPOSITORIES) {
      expect(repositories[name]).toBeDefined();
    }
  });

  it('ends the pool it was handed on close, and closes cleanly without one', async () => {
    const end = vi.fn(async () => {});
    const handed = new PostgresRepositories({
      type: 'drizzle',
      db,
      sql: { end } as unknown as Sql,
    });

    await handed.close();
    await new PostgresRepositories({ type: 'drizzle', db }).close();

    expect(end).toHaveBeenCalledTimes(1);
  });

  it('opens its own pool from a url, sized as configured', async () => {
    const repositories = new PostgresRepositories({
      type: 'url',
      url: 'postgres://vp:vp@127.0.0.1:9/vp',
      max: 4,
    });

    expect(repositories.videos).toBeDefined();
    await repositories.close();
  });
});
