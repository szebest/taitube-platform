import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewNotificationInput } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { NotificationService } from '../notification-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000f001', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000f002', role: 'USER' };
const GUEST: UserContext = { id: '00000000-0000-7000-8000-00000000f003', role: 'GUEST' };

const processing = (userId: string, videoId: string): NewNotificationInput => ({
  userId,
  kind: 'processing',
  actorChannelId: null,
  videoId,
  commentId: null,
  groupKey: null,
  payload: { actor: null, videoTitle: 'Dinner', excerpt: null, outcome: 'ready' },
});

describe('NotificationService', () => {
  let repositories: InMemoryRepositories;
  let service: NotificationService;

  const recordFor = async (user: UserContext, videoId: string) =>
    expectOk(await repositories.notifications.record(processing(user.id, videoId)));

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new NotificationService({
      notifications: repositories.notifications,
      paginator: new Paginator(),
    });
  });

  it.each<{ action: string; call: () => Promise<Result<unknown, { code: string }>> }>([
    { action: 'list', call: () => service.list(GUEST, { filter: 'all' }) },
    { action: 'count', call: () => service.unreadCount(GUEST) },
    { action: 'mark read', call: () => service.markRead(GUEST, { all: true }) },
  ])('refuses a guest-role caller on $action', async ({ call }) => {
    expect(expectErr(await call()).code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('lists the caller own notifications in views, with a cursor to the next page', async () => {
    await recordFor(OWNER, '00000000-0000-7000-8000-0000000000a1');
    await recordFor(OWNER, '00000000-0000-7000-8000-0000000000a2');
    await recordFor(STRANGER, '00000000-0000-7000-8000-0000000000a3');

    const page = expectOk(await service.list(OWNER, { filter: 'all', limit: 1 }));

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ kind: 'processing', read: false });
    expect(page.nextCursor).not.toBeNull();
  });

  it('marks the caller ids as read and counts what is left', async () => {
    const first = await recordFor(OWNER, '00000000-0000-7000-8000-0000000000a1');
    await recordFor(OWNER, '00000000-0000-7000-8000-0000000000a2');

    const marked = expectOk(await service.markRead(OWNER, { ids: [first?.id ?? ''] }));

    expect(marked).toEqual({ unreadCount: 1 });
    expect(expectOk(await service.unreadCount(OWNER))).toEqual({ unreadCount: 1 });
  });

  it("refuses someone else's id and marks none of the request", async () => {
    const mine = await recordFor(OWNER, '00000000-0000-7000-8000-0000000000a1');
    const theirs = await recordFor(STRANGER, '00000000-0000-7000-8000-0000000000a2');

    const failure = expectErr(
      await service.markRead(OWNER, { ids: [mine?.id ?? '', theirs?.id ?? ''] })
    );

    expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
    expect(expectOk(await service.unreadCount(OWNER))).toEqual({ unreadCount: 1 });
    expect(expectOk(await service.unreadCount(STRANGER))).toEqual({ unreadCount: 1 });
  });
});
