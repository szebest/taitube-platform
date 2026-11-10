import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { liftRestriction, moderateComment, pinComment, unpinComment } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { AUTHOR_ID, COMMENT_ID, comment } from '#app/__tests__/comment-fixtures';
import { AppProviders } from '#app/__tests__/providers';
import { useCommentModeration } from '../use-comment-moderation';

const showToast = vi.fn();

vi.mock(import('@vp/ui'), async (importOriginal) => ({
  ...(await importOriginal()),
  useToast: () => showToast,
}));

function render(
  top: Parameters<typeof comment>[0] = {},
  channelId: string | undefined = CHANNEL_ID
) {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <AppProviders>{children}</AppProviders>
    </QueryClientProvider>
  );

  return renderHook(() => useCommentModeration(comment(top), channelId), { wrapper }).result;
}

describe('apps/client/web: useCommentModeration', () => {
  beforeEach(() => {
    showToast.mockClear();
  });

  it.each([
    { pinned: false, method: 'POST' },
    { pinned: true, method: 'DELETE' },
  ])('sends $method to toggle a pin that is $pinned', async ({ pinned, method }) => {
    const sent: string[] = [];
    apiServer.use(
      ...[pinComment, unpinComment].map((contract) =>
        mockEndpoint(contract, ({ request, params }) => {
          sent.push(`${request.method} ${params.id}`);
          return HttpResponse.json(comment());
        })
      )
    );

    const moderation = render({ isPinned: pinned });
    act(() => moderation.current.togglePin());

    await vi.waitFor(() => expect(sent).toEqual([`${method} ${COMMENT_ID}`]));
  });

  it.each([
    { action: 'approve', title: 'The comment is approved' },
    { action: 'unhide', title: 'The comment is visible again' },
  ] as const)('sends $action and says so', async ({ action, title }) => {
    const sent: unknown[] = [];
    apiServer.use(
      mockEndpoint(moderateComment, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ state: 'published', comment: comment() });
      })
    );

    const moderation = render();
    act(() => moderation.current.run(action));

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith({ tone: 'success', title }));
    expect(sent).toEqual([{ action }]);
  });

  it.each([
    { channelId: CHANNEL_ID, sent: [`${AUTHOR_ID} ${CHANNEL_ID}`] },
    { channelId: undefined, sent: [] },
  ])(
    'lifts the restriction only with a channel to lift it on: $channelId',
    async ({ channelId, sent: expected }) => {
      const sent: string[] = [];
      apiServer.use(
        mockEndpoint(liftRestriction, ({ request, params }) => {
          sent.push(`${params.userId} ${request.headers.get('x-channel-id')}`);
          return new HttpResponse(null, { status: 204 });
        })
      );

      const moderation = render({}, channelId);
      act(() => moderation.current.run('lift'));

      await vi.waitFor(() => expect(sent).toEqual(expected));
    }
  );
});
