import { act, renderHook } from '@testing-library/react';
import { addPlaylistItem, listMyPlaylists } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { account, apiServer, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse } from 'msw/http';
import type { ComponentType, PropsWithChildren } from 'react';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { useVideoActions } from '../use-video-actions';

const WATCH_LATER_ID = '0190c3a0-5e1d-7000-8000-00000000d001';

function renderActions(Providers: ComponentType<PropsWithChildren>) {
  const client = createQueryClient();
  return renderHook(() => useVideoActions(VIDEO_ID), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <Providers>{children}</Providers>
      </QueryClientProvider>
    ),
  });
}

function playlistsApi(containsVideo: boolean, asked: string[]) {
  return [
    mockEndpoint(listMyPlaylists, ({ request }) => {
      asked.push(`list ${new URL(request.url).searchParams.get('videoId')}`);
      return HttpResponse.json({
        items: [
          {
            id: WATCH_LATER_ID,
            title: 'Watch Later',
            visibility: 'private' as const,
            isSystem: true,
            videoCount: 1,
            containsVideo,
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      });
    }),
    mockEndpoint(addPlaylistItem, ({ params }) => {
      asked.push(`add ${params.id}`);
      return new HttpResponse(null, { status: 201 });
    }),
  ];
}

describe('apps/client/web: useVideoActions', () => {
  it('offers a guest nothing', () => {
    const { result } = renderActions(AppProviders);

    expect(result.current).toEqual({ save: undefined });
  });

  it.each([
    {
      scenario: 'not on Watch Later yet',
      containsVideo: false,
      calls: [`list ${VIDEO_ID}`, `add ${WATCH_LATER_ID}`],
    },
    { scenario: 'already on Watch Later', containsVideo: true, calls: [`list ${VIDEO_ID}`] },
  ])('saves a video $scenario for a member', async ({ containsVideo, calls }) => {
    const asked: string[] = [];
    apiServer.use(...playlistsApi(containsVideo, asked));
    const { result } = renderActions(signedIn(account()));

    act(() => result.current.save?.());

    await vi.waitFor(() => expect(asked).toEqual(calls));
    expect(result.current.enqueue).toBeUndefined();
  });
});
