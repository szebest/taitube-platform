import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { Video } from '@vp/api-contracts';
import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, api, video } from '@vp/web-testing';

import { AppProviders } from '#app/__tests__/providers';
import { VideoProcessingStatus } from '../video-processing-status';

const detailKey = videoQueryOptions(api, VIDEO_ID).queryKey;

function renderStatus(cached: Video) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(detailKey, cached);
  render(
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <VideoProcessingStatus videoId={VIDEO_ID} />
      </AppProviders>
    </QueryClientProvider>
  );
  return {
    line: () => screen.getByRole('status', { name: 'Processing status' }),
    patch: (patched: Video) => queryClient.setQueryData(detailKey, patched),
  };
}

describe('apps/client/studio: VideoProcessingStatus', () => {
  it('follows the cached video as the user event stream patches it', async () => {
    const { line, patch } = renderStatus(
      video({ status: 'PROCESSING', progress: { overall: 10, byRendition: { '720p': 20 } } })
    );
    expect(line()).toHaveTextContent('Processing, 10% encoded');

    patch(video({ status: 'READY', progress: { overall: 100, byRendition: { '720p': 100 } } }));

    await vi.waitFor(() => expect(line()).toHaveTextContent('Ready, 100% encoded'));
  });
});
