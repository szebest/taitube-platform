import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';

import { AppProviders } from '#app/__tests__/providers';
import { PickOfTheDay } from '#app/components/discovery/pick-of-the-day';
import { PickWindow } from '../pick-window';

const NOW = Date.parse('2026-10-30T10:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function renderWindow(leftMs: number) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AppProviders>
        <PickOfTheDay.Root>
          <PickWindow endsAt={new Date(NOW + leftMs).toISOString()} />
        </PickOfTheDay.Root>
      </AppProviders>
    </QueryClientProvider>
  );
}

describe('apps/client/web: PickWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { name: 'whole hours while more than an hour is left', left: 14 * HOUR + 5 * MINUTE, text: 'Picked today, 14 hr left' },
    { name: 'one hour at an hour', left: HOUR, text: 'Picked today, 1 hr left' },
    { name: 'minutes in the last hour', left: 40 * MINUTE, text: 'Picked today, 40 min left' },
    { name: 'a started minute as a whole one', left: 1_000, text: 'Picked today, 1 min left' },
  ])('counts $name', ({ left, text }) => {
    renderWindow(left);

    expect(screen.getByRole('timer')).toHaveTextContent(text);
  });

  it('says nothing once the window has ended', () => {
    renderWindow(-MINUTE);

    expect(screen.getByRole('timer')).toBeEmptyDOMElement();
  });
});
