import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';
import { apiServer } from '@vp/web-testing';
import type { PropsWithChildren } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { managedPost, POST_ID, servePosts } from '#app/features/posts/__tests__/posts-api.fixture';
import { postKeys } from '#app/features/posts/api/post-queries';
import { useCreatePost, useDeletePost, usePinPost, useUpdatePost } from '../use-post-mutations';

const BODY = {
  payload: { kind: 'text', text: 'Hello' },
  commentsEnabled: true,
  timing: { mode: 'now' },
} as const;

function mutate<T>(useHook: () => { mutateAsync: (input: T) => Promise<unknown> }, input: T) {
  const client = createQueryClient();
  client.setQueryData(postKeys.list('c', undefined), { pages: [], pageParams: [] });
  const wrapper = ({ children }: PropsWithChildren) => (
    <AppProviders>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </AppProviders>
  );
  const result = renderHook(useHook, { wrapper }).result.current.mutateAsync(input);
  return { client, result };
}

describe('apps/client/studio: post mutations', () => {
  it('sends each write to its endpoint, an edit with the version it was made against', async () => {
    const { requests, handlers } = servePosts({ posts: [managedPost()] });
    apiServer.use(...handlers);

    await mutate(useCreatePost, BODY).result;
    await mutate(useUpdatePost, { id: POST_ID, version: 3, body: BODY }).result;
    await mutate(usePinPost, { id: POST_ID, pin: true }).result;
    await mutate(usePinPost, { id: POST_ID, pin: false }).result;
    await mutate(useDeletePost, POST_ID).result;

    expect(requests.created).toEqual([BODY]);
    expect(requests.updated).toEqual([{ id: POST_ID, body: { ...BODY, version: 3 } }]);
    expect(requests.pinned).toEqual([POST_ID]);
    expect(requests.unpinned).toEqual([POST_ID]);
    expect(requests.deleted).toEqual([POST_ID]);
  });

  it.each([
    { write: 'a create', run: () => mutate(useCreatePost, BODY) },
    { write: 'a pin', run: () => mutate(usePinPost, { id: POST_ID, pin: true }) },
    { write: 'a delete', run: () => mutate(useDeletePost, POST_ID) },
  ])('refreshes every list of posts after $write', async ({ run }) => {
    apiServer.use(...servePosts({ posts: [managedPost()] }).handlers);
    const { client, result } = run();

    await result;

    expect(client.getQueryState(postKeys.list('c', undefined))?.isInvalidated).toBe(true);
  });
});
