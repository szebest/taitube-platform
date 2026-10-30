import * as schema from '@vp/db';
import { expectOk } from '@vp/testing/result';
import { drizzle } from 'drizzle-orm/pglite';
import { describeRelatedVideosRepositoryContract } from '../../../__tests__/contract/related-videos-repository.contract';
import {
  CATEGORY_MUSIC_ID,
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  publicVideo,
  seedCategories,
  seedOwners,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { PostgresRelatedVideosRepository } from '../postgres-related-videos-repository';
import { PostgresRepositories } from '../postgres-repositories';

describeRelatedVideosRepositoryContract(postgresSubject);

describe('PostgresRelatedVideosRepository statements', () => {
  const statements: { query: string; params: unknown[] }[] = [];
  let engine: Awaited<ReturnType<typeof migratedPglite>>;
  let repositories: PostgresRepositories;
  let related: PostgresRelatedVideosRepository;

  const find = async (limit: number, overrides = {}) =>
    expectOk(
      await related.find({
        videoId: VIDEO_IDS.a,
        ownerId: OWNER_ID,
        categoryId: CATEGORY_MUSIC_ID,
        tags: ['lisbon'],
        excludeOwnerId: null,
        limit,
        ...overrides,
      })
    );

  beforeAll(async () => {
    engine = await migratedPglite();
    const db = drizzle(engine, {
      schema,
      logger: { logQuery: (query, params) => statements.push({ query, params }) },
    });
    repositories = new PostgresRepositories({ type: 'drizzle', db });
    related = new PostgresRelatedVideosRepository(db);
    await seedOwners(repositories);
    await seedCategories(repositories);
    const seeds = [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d, VIDEO_IDS.e];
    for (const id of seeds) {
      expectOk(
        await repositories.videos.create(
          publicVideo({ id, ownerId: OTHER_OWNER_ID, tags: ['lisbon'], categoryId: null })
        )
      );
    }
  });

  afterAll(async () => {
    await engine.close();
  });

  beforeEach(() => {
    statements.length = 0;
  });

  it('runs one statement when nothing is a candidate', async () => {
    expect(
      await find(2, {
        videoId: '00000000-0000-7000-8000-0000000000c1',
        ownerId: '00000000-0000-7000-8000-0000000000c2',
        categoryId: null,
        tags: [],
      })
    ).toEqual([]);
    expect(statements).toHaveLength(1);
  });

  it('runs two statements and hydrates only the limit', async () => {
    expect(await find(2)).toHaveLength(2);

    expect(statements).toHaveLength(2);
    const [, hydrate] = statements;
    const hydrated = hydrate?.params.filter(
      (param) => typeof param === 'string' && param.startsWith('00000000-')
    );
    expect(hydrated?.filter((id) => id !== VIDEO_IDS.a)).toHaveLength(2);
  });
});
