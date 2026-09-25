import { isNotFound } from '@tanstack/react-router';
import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { ensureVideo } from '../ensure-video';

function problem(status: number): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'x', status, code: 'X', detail: 'x' }),
    { status, headers: { 'content-type': 'application/problem+json' } }
  );
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  const settled = await Promise.allSettled([promise]);
  return settled[0]?.status === 'rejected' ? settled[0].reason : undefined;
}

describe('apps/web: ensureVideo', () => {
  it('loads the video once and serves the cached copy after that', async () => {
    const sent = recordRequests(() => jsonResponse(video({ title: 'Launch day' })));
    const queryClient = createQueryClient();

    await ensureVideo(queryClient, VIDEO_ID);
    const again = await ensureVideo(queryClient, VIDEO_ID);

    expect(again.title).toBe('Launch day');
    expect(sent).toHaveLength(1);
  });

  it('turns a 404 into the not-found page', async () => {
    recordRequests(() => problem(404));

    expect(isNotFound(await rejection(ensureVideo(createQueryClient(), VIDEO_ID)))).toBe(true);
  });

  it('leaves any other failure to the error page', async () => {
    recordRequests(() => problem(500));

    const thrown = await rejection(ensureVideo(createQueryClient(), VIDEO_ID));

    expect(isNotFound(thrown)).toBe(false);
    expect(thrown).toBeInstanceOf(Error);
  });
});
