import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import { type PropsWithChildren, useEffect } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { PlayerChannelProvider, useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import type { PlayerCard } from '#app/lib/player/taitube-player-props';
import { PlayerCardLayer } from '../player-card-layer';

const CARDS: PlayerCard[] = [
  { id: 'a', startMs: 10_000, endMs: 15_000, text: 'It costs 5 dollars' },
  { id: 'b', startMs: 12_000, endMs: 20_000, text: 'The year is 2026' },
];

let publishTime: (seconds: number) => void = () => {};

function Clock({ children }: PropsWithChildren) {
  const channel = useOfferedPlayerChannel();
  useEffect(() => {
    publishTime = (seconds) => channel?.publish(seconds);
  }, [channel]);
  return children;
}

const renderLayer = (cards: readonly PlayerCard[] = CARDS) =>
  render(
    <AppProviders>
      <PlayerChannelProvider>
        <Clock>
          <PlayerCardLayer cards={cards} />
        </Clock>
      </PlayerChannelProvider>
    </AppProviders>
  );

const at = (seconds: number) => act(() => publishTime(seconds));

describe('apps/client/web: PlayerCardLayer', () => {
  it.each([
    { seconds: 5, shown: null },
    { seconds: 10, shown: 'It costs 5 dollars' },
    { seconds: 14.9, shown: 'It costs 5 dollars' },
    { seconds: 15, shown: 'The year is 2026' },
    { seconds: 20, shown: null },
  ])('shows $shown at $seconds s, one card at a time', ({ seconds, shown }) => {
    renderLayer();

    at(seconds);

    expect(
      screen.queryAllByRole('note').map((note) => note.textContent?.replace(/x$/, ''))
    ).toEqual(shown ? [shown] : []);
  });

  it('dismisses a card with its button, and keeps it dismissed when the playhead comes back', async () => {
    renderLayer();
    at(11);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss this note' }));
    at(5);
    at(11);

    expect(screen.queryByRole('note')).toBeNull();
  });

  it('dismisses a card with Escape from inside it', async () => {
    renderLayer();
    at(11);

    screen.getByRole('button', { name: 'Dismiss this note' }).focus();
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('note')).toBeNull();
  });

  it('keeps clear of the control bar, which sits in the bottom of the frame', () => {
    const { container } = renderLayer();
    at(11);

    expect(
      container.querySelector('[data-slot="player-card"]')?.parentElement?.className
    ).toContain('bottom-20');
  });

  it('draws nothing without cards', () => {
    const { container } = renderLayer([]);
    at(11);

    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations while a card is up', async () => {
    renderLayer();
    at(11);

    expect(await axeViolations()).toEqual([]);
  });
});
