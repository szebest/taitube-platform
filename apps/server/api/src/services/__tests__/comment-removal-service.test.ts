import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { Paginator } from '@vp/pagination';
import { expectOk } from '@vp/testing/result';
import { CommentRemovalService } from '../comment-removal-service';

const AUTHOR = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' } as const;
const DAY_MS = 86_400_000;

describe('apps/server/api/services: comment removals', () => {
  it('reads only the last 30 days of the caller, from the clock it is given', async () => {
    const repositories = new InMemoryRepositories();
    const listRemovals = vi.spyOn(repositories.commentModeration, 'listRemovals');
    const now = Date.parse('2026-03-31T00:00:00.000Z');
    const service = new CommentRemovalService({
      moderation: repositories.commentModeration,
      paginator: new Paginator({ defaultLimit: 10, maxLimit: 50 }),
      now: () => now,
    });

    expectOk(await service.listOwn(AUTHOR, { limit: 5 }));

    expect(listRemovals).toHaveBeenCalledWith(AUTHOR.id, {
      since: new Date(now - 30 * DAY_MS),
      cursor: null,
      limit: 5,
    });
  });
});
