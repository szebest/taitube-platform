import type * as schema from '@vp/db';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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

  it('leaves a pool it was handed open on close, for its owner to end', async () => {
    const pool = postgres('postgres://vp:vp@127.0.0.1:9/vp', { max: 1 });
    const end = vi.spyOn(pool, 'end');

    await new PostgresRepositories({ type: 'sql', sql: pool }).close();

    expect(end).not.toHaveBeenCalled();
    await pool.end();
  });

  it('ends the pool it opened from a url', async () => {
    const repositories = new PostgresRepositories({
      type: 'url',
      url: 'postgres://vp:vp@127.0.0.1:9/vp',
      max: 4,
    });

    expect(repositories.videos).toBeDefined();
    await repositories.close();
  });
});
