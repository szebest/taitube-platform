import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { VideoCard } from '#app/components/video/video-card';
import { PickOfTheDay, PickOfTheDaySkeleton } from '..';
import type { PickOfTheDayRootProps } from '../pick-of-the-day';

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000021';

const renderPick = (props: PickOfTheDayRootProps = {}) =>
  render(
    <AppProviders>
      <PickOfTheDay.Root {...props}>
        <VideoCard.Root variant="spotlight" videoId={VIDEO_ID}>
          <VideoCard.Thumb alt="" duration="18:42" />
          <PickOfTheDay.Kicker />
          <VideoCard.Title asChild>
            <a href={`/watch/${VIDEO_ID}`}>Lisbon at night</a>
          </VideoCard.Title>
          <PickOfTheDay.Note>Eighteen minutes of trams and wet tiles.</PickOfTheDay.Note>
          <PickOfTheDay.Window>Picked today, 14 h left</PickOfTheDay.Window>
          <PickOfTheDay.Actions>
            <button type="button">Watch</button>
          </PickOfTheDay.Actions>
        </VideoCard.Root>
      </PickOfTheDay.Root>
    </AppProviders>
  );

const glow = () =>
  document.querySelector<HTMLElement>('[data-slot="pick-of-the-day"] > [aria-hidden]');

describe('apps/client/web: PickOfTheDay', () => {
  it('is a section named by its kicker, holding the card, the note and the window as text', () => {
    renderPick();

    const pick = screen.getByRole('region', { name: 'Pick of the day' });

    expect(within(pick).getByRole('link', { name: 'Lisbon at night' })).toBeInTheDocument();
    expect(within(pick).getByText('Eighteen minutes of trams and wet tiles.').tagName).toBe('P');
    expect(within(pick).getByText('Picked today, 14 h left')).toBeInTheDocument();
    expect(within(pick).getByRole('button', { name: 'Watch' })).toBeInTheDocument();
  });

  it.each([
    { layout: undefined, expected: 'responsive' },
    { layout: 'default', expected: 'default' },
    { layout: 'stacked', expected: 'stacked' },
  ] as const)('lays the card out $expected for the layout $layout', ({ layout, expected }) => {
    renderPick({ layout });

    expect(screen.getByRole('region')).toHaveAttribute('data-layout', expected);
  });

  it.each([
    { glowColor: 'sienna', painted: 'sienna' },
    { glowColor: undefined, painted: undefined },
  ])('paints the sampled colour $glowColor only as a hidden glow', ({ glowColor, painted }) => {
    renderPick({ glowColor });

    expect(glow()?.style.backgroundColor).toBe(painted);
  });

  it('names a part used outside the root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<PickOfTheDay.Window />)).toThrow(
      'PickOfTheDay.Window must be inside PickOfTheDay.Root'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderPick({ glowColor: 'sienna' });
    render(<PickOfTheDaySkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
