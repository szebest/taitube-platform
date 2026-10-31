import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { listAdminVideos } from '@vp/api-contracts';
import { ApiProvider, createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';

import { adminVideo } from '#app/features/admin/components/__tests__/moderation.fixture';
import { usePickableVideos } from '../use-pickable-videos';

const VIDEO = adminVideo();

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('apps/client/studio: usePickableVideos', () => {
  it('reads the public, ready videos for the text typed, and follows it', async () => {
    const asked: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listAdminVideos, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('q'));
        return HttpResponse.json({ items: [VIDEO], nextCursor: null });
      })
    );

    const { result, rerender } = renderHook(({ text }) => usePickableVideos(text), {
      wrapper: Providers,
      initialProps: { text: '' },
    });
    await waitFor(() => expect(result.current.data).toEqual([VIDEO]));
    rerender({ text: 'cats' });

    await waitFor(() => expect(asked).toEqual([null, 'cats']));
  });
});
