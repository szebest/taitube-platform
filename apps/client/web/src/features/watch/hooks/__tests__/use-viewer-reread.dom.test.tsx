import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { api, apiServer, mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { useViewerReread } from '../use-viewer-reread';

const SHARE_TOKEN = 'abcdefghijklmnopqrstuv';

function renderReread(readOnServer: boolean) {
  const reads: (string | null)[] = [];
  apiServer.use(
    mockEndpoint(getVideo, ({ request }) => {
      reads.push(new URL(request.url).searchParams.get('s'));
      return HttpResponse.json(video({ title: 'Variant B' }));
    })
  );
  const client = createQueryClient();
  client.setQueryData(videoQueryOptions(api, VIDEO_ID).queryKey, video({ title: 'Control' }));
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(
    () => {
      useViewerReread(VIDEO_ID, readOnServer);
      return useQuery(videoQueryOptions(api, VIDEO_ID, SHARE_TOKEN)).data?.title;
    },
    { wrapper }
  );
  return { ...rendered, client, reads };
}

describe('apps/client/web: useViewerReread', () => {
  it("reads a server-rendered video once more in the browser, with the page's share link, and shows what it answers", async () => {
    const { result, rerender, reads } = renderReread(true);

    expect(result.current).toBe('Control');
    await vi.waitFor(() => expect(result.current).toBe('Variant B'));
    rerender();

    expect(reads).toEqual([SHARE_TOKEN]);
  });

  it('reads nothing again when the browser loaded the page itself', () => {
    const { result, client, reads } = renderReread(false);

    expect(result.current).toBe('Control');
    expect(client.isFetching()).toBe(0);
    expect(reads).toEqual([]);
  });
});
