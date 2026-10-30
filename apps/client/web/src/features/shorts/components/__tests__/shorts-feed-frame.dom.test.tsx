import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderShorts } from '#app/features/shorts/__tests__/render-shorts';
import { SHORTS } from '#app/features/shorts/__tests__/short-fixtures';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/shorts/__tests__/stub-short-player')).StubShortPlayer,
}));

const pathOf = (position: number) => `/shorts/${SHORTS[position - 1]?.id}`;

async function renderFrame(path?: string) {
  const rendered = await renderShorts({ path });
  const frame = screen.getByRole('region', { name: 'Shorts player' });
  return { ...rendered, frame, player: await screen.findByTestId('player') };
}

describe('apps/client/web: ShortsFeedFrame', () => {
  it('plays the first Short muted and vertical, with its channel and title over it', async () => {
    const { player, frame } = await renderFrame();

    expect(player).toHaveAttribute('data-layout', 'vertical');
    expect(player).toHaveAttribute('data-paused', 'false');
    expect(player).toHaveAttribute('data-muted', 'true');
    expect(frame).toHaveTextContent('The Creator');
    expect(frame).toHaveTextContent('Short 1');
  });

  it.each([
    { key: '{ArrowDown}', from: 1, to: 2 },
    { key: 'j', from: 1, to: 2 },
    { key: '{ArrowUp}', from: 2, to: 1 },
    { key: 'k', from: 2, to: 1 },
  ])(
    'moves from Short $from to Short $to on $key, replacing the URL',
    async ({ key, from, to }) => {
      const { router, user } = await renderFrame(pathOf(from));
      screen.getByRole('button', { name: 'Pause' }).focus();

      await user.keyboard(key);

      await waitFor(() => expect(router.state.location.pathname).toBe(pathOf(to)));
      expect(router.history.length).toBe(1);
      expect(await screen.findByText(`Short ${to}`, { selector: 'p' })).toBeInTheDocument();
    }
  );

  it('announces the Short that came into view, by its title and channel', async () => {
    const { user } = await renderFrame();
    screen.getByRole('button', { name: 'Pause' }).focus();

    await user.keyboard('{ArrowDown}');

    expect(await screen.findByRole('status')).toHaveTextContent('Short 2, by The Creator');
  });

  it.each([
    { key: ' ', attribute: 'data-paused', before: 'false', after: 'true' },
    { key: 'm', attribute: 'data-muted', before: 'true', after: 'false' },
  ])('toggles $attribute on the key "$key"', async ({ key, attribute, before, after }) => {
    const { user, player } = await renderFrame();
    screen.getByRole('button', { name: 'Pause' }).focus();
    expect(player).toHaveAttribute(attribute, before);

    await user.keyboard(key);

    expect(player).toHaveAttribute(attribute, after);
  });

  it('steps once for a stream of wheel events, the way a trackpad delivers one flick', async () => {
    const { router, frame } = await renderFrame();

    fireEvent.wheel(frame, { deltaY: 120 });
    fireEvent.wheel(frame, { deltaY: 90 });
    fireEvent.wheel(frame, { deltaY: 60 });

    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf(2)));
  });

  it('starts each Short paused under the reduced motion set', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    );

    const { player } = await renderFrame();

    await waitFor(() => expect(player).toHaveAttribute('data-paused', 'true'));
  });

  it('says the viewer is caught up on the last Short, and goes no further', async () => {
    const { router, user } = await renderFrame(pathOf(SHORTS.length));
    screen.getByRole('button', { name: 'Pause' }).focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByText('You are all caught up')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(pathOf(SHORTS.length));
  });
});
