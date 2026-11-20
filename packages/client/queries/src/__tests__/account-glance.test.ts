import { getUnreadNotificationCount, listNotifications } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse, delay } from 'msw';
import { glanceAccounts } from '../account-glance';
import { inRequest } from './in-request';

const TEN_SLOTS = Array.from({ length: 10 }, (_, slot) => `vp.session.${slot}=token-${slot}`).join(
  '; '
);

const slotOf = (request: Request) =>
  Number(request.headers.get('authorization')?.replace('Bearer token-', ''));

function notification(kind: 'comment' | 'upload', read: boolean) {
  return {
    id: crypto.randomUUID(),
    kind,
    actorChannelId: null,
    videoId: null,
    commentId: null,
    payload: {
      count: 1,
      actor: null,
      videoTitle: null,
      excerpt: null,
      outcome: null,
      party: null,
    },
    read,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function answering(answer: (slot: number) => Promise<Response | undefined> | Response | undefined) {
  const asked: number[] = [];
  apiServer.use(
    mockEndpoint(getUnreadNotificationCount, async ({ request }) => {
      const slot = slotOf(request);
      asked.push(slot);
      return (await answer(slot)) ?? HttpResponse.json({ unreadCount: slot });
    }),
    mockEndpoint(listNotifications, () =>
      HttpResponse.json({
        items: [
          notification('comment', false),
          notification('comment', true),
          notification('upload', false),
        ],
        nextCursor: null,
      })
    )
  );
  return asked;
}

describe('@vp/queries: account glance', () => {
  it('asks every other slot in one call, in parallel, with its own token', async () => {
    const asked = answering(async () => {
      await delay(300);
      return undefined;
    });
    const started = performance.now();

    const { value } = await inRequest(() => glanceAccounts({ data: { slot: 0 } }), {
      cookie: TEN_SLOTS,
    });

    expect(performance.now() - started).toBeLessThan(1500);
    expect(asked.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(value).toHaveLength(9);
    expect(value[0]).toEqual({ slot: 1, state: 'counted', unread: 1, newComments: 1 });
  });

  it.each([
    {
      scenario: 'never answers',
      answer: async () => {
        await delay('infinite');
        return undefined;
      },
      glance: { slot: 1, state: 'unknown' },
    },
    {
      scenario: 'fails',
      answer: () => problemReply(ErrorCodes.INTERNAL),
      glance: { slot: 1, state: 'unknown' },
    },
    {
      scenario: 'refuses its token',
      answer: () => problemReply(ErrorCodes.UNAUTHORIZED),
      glance: { slot: 1, state: 'expired' },
    },
  ])('gives a slot that $scenario no count, and the others theirs', async ({ answer, glance }) => {
    answering((slot) => (slot === 1 ? answer() : undefined));

    const { value } = await inRequest(() => glanceAccounts({ data: { slot: 0 } }), {
      cookie: 'vp.session.0=token-0; vp.session.1=token-1; vp.session.2=token-2',
    });

    expect(value).toEqual([glance, { slot: 2, state: 'counted', unread: 2, newComments: 1 }]);
  });
});
