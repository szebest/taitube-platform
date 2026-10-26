import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { CreatorCommentService } from '../creator-comment-service';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const FAN = '22222222-2222-7222-8222-222222222222';
const VIDEO_ID = '33333333-3333-7333-8333-333333333333';

describe('CreatorCommentService', () => {
  let repositories: InMemoryRepositories;
  let service: CreatorCommentService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new CreatorCommentService({
      comments: repositories.comments,
      paginator: new Paginator(),
    });
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Clip',
      sourceKey: `raw/${VIDEO_ID}/source.mp4`,
      visibility: 'public',
      status: 'READY',
    });
    for (const content of ['one', 'two', 'three']) {
      await repositories.comments.create({
        id: crypto.randomUUID(),
        videoId: VIDEO_ID,
        authorId: FAN,
        parentId: null,
        content,
      });
    }
  });

  it('pages the inbox with a cursor and renders each comment with its video', async () => {
    const first = expectOk(await service.inbox(OWNER, { filter: 'all', limit: 2 }));
    const second = expectOk(
      await service.inbox(OWNER, { filter: 'all', limit: 2, cursor: first.nextCursor ?? undefined })
    );

    expect(first.items).toHaveLength(2);
    expect(first.items[0]).toMatchObject({ video: { id: VIDEO_ID, title: 'Clip' } });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('refuses a cursor it did not issue', async () => {
    const result = await service.inbox(OWNER, { filter: 'all', cursor: 'garbage' });

    expect(expectErr(result).code).toBe(ErrorCodes.INVALID_CURSOR);
  });
});
