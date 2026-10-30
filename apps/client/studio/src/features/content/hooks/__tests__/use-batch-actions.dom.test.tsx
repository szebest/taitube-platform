import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteCreatorVideo } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { delay, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';

import { signedIn } from '#app/__tests__/providers';
import { videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import { serveManagement } from '#app/features/content/__tests__/library-api.fixture';
import { useBatchActions } from '../use-batch-actions';

const Providers = signedIn();

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>
    <Providers>{children}</Providers>
  </QueryClientProvider>
);

const listed = (...indexes: number[]) =>
  indexes.map((index) => ({ id: videoIdOf(index), version: 1 }));

describe('apps/client/studio: useBatchActions', () => {
  it('answers which videos a delete went through for, and which not', async () => {
    serveManagement([videoIdOf(1)]);
    const { result } = renderHook(() => useBatchActions(), { wrapper });

    const outcome = await result.current.deleteVideos(listed(0, 1));

    expect(outcome).toEqual({ succeeded: [videoIdOf(0)], failed: [videoIdOf(1)] });
  });

  it('answers the same for a visibility change', async () => {
    serveManagement();
    const { result } = renderHook(() => useBatchActions(), { wrapper });

    const outcome = await result.current.setVisibility(listed(0, 2), 'private');

    expect(outcome).toEqual({ succeeded: [videoIdOf(0), videoIdOf(2)], failed: [] });
  });

  it.each([
    { name: 'every video', failing: [], toast: '2 videos deleted' },
    {
      name: 'some videos',
      failing: [1],
      toast: '1 of 2 done, 1 failed. The failed ones stay selected.',
    },
    { name: 'no video', failing: [0, 1], toast: 'Nothing was changed. Try again.' },
  ])('toasts what happened when it deletes $name', async ({ failing, toast }) => {
    serveManagement(failing.map(videoIdOf));
    function Probe() {
      const { deleteVideos } = useBatchActions();
      return (
        <button type="button" onClick={() => void deleteVideos(listed(0, 1))}>
          go
        </button>
      );
    }
    render(<Probe />, { wrapper });

    screen.getByRole('button', { name: 'go' }).click();

    expect(await screen.findByText(toast)).toBeInTheDocument();
  });

  it('is pending while a batch is in flight', async () => {
    apiServer.use(
      mockEndpoint(deleteCreatorVideo, async ({ params }) => {
        await delay(100);
        return HttpResponse.json(
          { videoId: String(params['id']), status: 'DELETED' as const },
          { status: 202 }
        );
      })
    );
    function Probe() {
      const { deleteVideos, pending } = useBatchActions();
      return (
        <button type="button" onClick={() => void deleteVideos(listed(0))}>
          {pending ? 'pending' : 'idle'}
        </button>
      );
    }
    const { container } = render(<Probe />, { wrapper });
    const button = within(container).getByRole('button');
    expect(button).toHaveTextContent('idle');

    await userEvent.click(button);

    expect(button).toHaveTextContent('pending');
    await waitFor(() => expect(button).toHaveTextContent('idle'));
  });
});
