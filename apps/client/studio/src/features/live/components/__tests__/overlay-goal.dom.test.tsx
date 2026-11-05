import { screen } from '@testing-library/react';

import { renderLive } from '../../__tests__/render-live';
import { OverlayGoal } from '../overlay-goal';

describe('apps/client/studio: OverlayGoal', () => {
  it.each([
    { count: 12, goal: 25, text: '12 of 25' },
    { count: 25, goal: 50, text: '25 of 50' },
    { count: 1000, goal: 2000, text: '1,000 of 2,000' },
  ])('aims $count subscribers at $goal', ({ count, goal, text }) => {
    renderLive(<OverlayGoal subscriberCount={count} />);

    const bar = screen.getByRole('progressbar', { name: 'Subscriber goal' });

    expect(bar).toHaveAttribute('aria-valuenow', String(count));
    expect(bar).toHaveAttribute('aria-valuemax', String(goal));
    expect(screen.getByText(/ of /)).toHaveTextContent(text);
  });
});
