import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteCreatorVideo } from '@vp/api-contracts';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { delay, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { videoIdOf } from '#app/__tests__/creator-video.fixture';
import { serveManagement } from '#app/__tests__/library-api.fixture';
import { signedIn } from '#app/__tests__/providers';
import { useBatchActions } from '../use-batch-actions';

const Providers = signedIn();

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>
    <Providers>{children}</Providers>
  </QueryClientProvider>
);

const listed = (...indexes: number[]) =>
  indexes.map((index) => ({ id: videoIdOf(index), title: `Video ${index}` }));

describe('apps/client/studio: useBatchActions', () => {
  it('answers which videos a delete went through for, and which not', async () => {
    serveManagement([videoIdOf(1)]);
    const { result } = renderHook(() => useBatchActions(), { wrapper });

    const outcome = await result.current.deleteVideos(listed(0, 1));

    expect(outcome.succeeded).toEqual([videoIdOf(0)]);
    expect(outcome.failed.map(({ id }) => id)).toEqual([videoIdOf(1)]);
  });

  it('answers the same for a bulk edit', async () => {
    serveManagement();
    const { result } = renderHook(() => useBatchActions(), { wrapper });

    const outcome = await result.current.editVideos(listed(0, 2), { visibility: 'private' });

    expect(outcome).toEqual({ succeeded: [videoIdOf(0), videoIdOf(2)], failed: [] });
  });

  it.each([
    { name: 'every video', failing: [], toast: '2 videos deleted', named: [] },
    {
      name: 'some videos',
      failing: [1],
      toast: '1 of 2 done, 1 failed. The failed ones stay selected.',
      named: ['Video 1'],
    },
    {
      name: 'no video',
      failing: [0, 1],
      toast: 'Nothing was changed. Try again.',
      named: ['Video 0', 'Video 1'],
    },
  ])('toasts what happened when it deletes $name', async ({ failing, toast, named }) => {
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
    for (const title of ['Video 0', 'Video 1']) {
      if (named.includes(title)) expect(document.body).toHaveTextContent(title);
      else expect(document.body).not.toHaveTextContent(title);
    }
  });

  it('lists at most five failures and counts the rest', async () => {
    const indexes = [0, 1, 2, 3, 4, 5, 6];
    serveManagement(indexes.map(videoIdOf));
    function Probe() {
      const { deleteVideos } = useBatchActions();
      return (
        <button type="button" onClick={() => void deleteVideos(listed(...indexes))}>
          go
        </button>
      );
    }
    render(<Probe />, { wrapper });

    screen.getByRole('button', { name: 'go' }).click();

    expect(await screen.findByText(/and 2 more/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Video 6');
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
