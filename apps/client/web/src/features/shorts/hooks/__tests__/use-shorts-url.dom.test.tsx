import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { SHORTS } from '#app/__tests__/short-fixtures';
import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const pathOf = (position: number) => `/shorts/${SHORTS[position - 1]?.id}`;

describe('apps/client/web: useShortsUrl', () => {
  it('names the Short the feed rests on in the URL, replacing the entry', async () => {
    const { router } = await renderShorts();

    fireEvent.keyDown(screen.getByRole('region', { name: 'Shorts player' }), { key: 'ArrowDown' });

    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf(2)));
    expect(router.history.length).toBe(1);
  });

  it('leaves the URL alone while the Short it names is the one on screen', async () => {
    const { router } = await renderShorts({ path: pathOf(2) });
    const navigate = vi.spyOn(router, 'navigate');

    await act(() => new Promise((settle) => setTimeout(settle, 300)));

    expect(navigate).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe(pathOf(2));
  });

  it('writes only where the feed came to rest, not each Short it passed', async () => {
    const { router } = await renderShorts();
    const frame = screen.getByRole('region', { name: 'Shorts player' });
    const navigate = vi.spyOn(router, 'navigate');

    fireEvent.keyDown(frame, { key: 'ArrowDown' });
    fireEvent.keyDown(frame, { key: 'ArrowDown' });

    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf(3)));
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('takes the feed to the Short something else sent the URL to', async () => {
    const { router } = await renderShorts();

    await act(() =>
      router.navigate({ to: '/shorts/$videoId', params: { videoId: SHORTS[2]?.id ?? '' } })
    );

    expect(await screen.findByRole('status')).toHaveTextContent('Short 3, by The Creator');
  });

  it('does not take the feed back to a Short it already left, as its own write lands late', async () => {
    const { router } = await renderShorts();
    const frame = screen.getByRole('region', { name: 'Shorts player' });

    fireEvent.keyDown(frame, { key: 'ArrowDown' });
    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf(2)));
    fireEvent.keyDown(frame, { key: 'ArrowDown' });

    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf(3)));
    expect(screen.getByRole('status')).toHaveTextContent('Short 3');
  });
});
