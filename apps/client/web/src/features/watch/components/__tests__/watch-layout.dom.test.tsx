import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { PlayerChannelProvider, usePlayerSeek } from '#app/features/player';
import { WatchLayout, type WatchLayoutProps } from '../watch-layout';

function TheaterToggle() {
  return (
    <button type="button" onClick={usePlayerSeek().toggleTheater}>
      Theater
    </button>
  );
}

const renderLayout = (props: Partial<WatchLayoutProps> = {}) =>
  render(
    <PlayerChannelProvider>
      <WatchLayout
        stage={<TheaterToggle />}
        details={<h1>Launch day</h1>}
        discussion={<p>Comments</p>}
        aside={<p>Queue</p>}
        {...props}
      />
    </PlayerChannelProvider>
  );

describe('apps/client/web: watch layout', () => {
  it.each([
    { scenario: 'the discussion and the aside', props: {}, asides: 1, text: 'Comments' },
    { scenario: 'no aside', props: { aside: undefined }, asides: 0, text: 'Comments' },
    { scenario: 'no discussion', props: { discussion: undefined }, asides: 1, text: undefined },
  ])('renders the stage and the details with $scenario', ({ props, asides, text }) => {
    renderLayout(props);

    expect(screen.getByRole('heading', { name: 'Launch day' })).toBeInTheDocument();
    expect(screen.queryAllByRole('complementary')).toHaveLength(asides);
    expect(screen.queryByText('Comments') !== null).toBe(text !== undefined);
  });

  it('marks theater mode once the player turns it on, and off again', async () => {
    const user = userEvent.setup();
    const { container } = renderLayout();
    const layout = container.querySelector('[data-slot=watch-layout]');
    expect(layout).not.toHaveAttribute('data-theater');

    await user.click(screen.getByRole('button', { name: 'Theater' }));
    expect(layout).toHaveAttribute('data-theater', 'true');

    await user.click(screen.getByRole('button', { name: 'Theater' }));
    expect(layout).not.toHaveAttribute('data-theater');
  });
});
