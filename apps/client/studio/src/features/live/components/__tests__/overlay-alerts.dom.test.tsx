import { act, screen } from '@testing-library/react';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { SUBSCRIBER_ALERT_MS } from '#app/features/live/hooks/use-subscriber-alert';
import { playChime } from '#app/features/live/overlay-chime';
import { OverlayAlerts } from '../overlay-alerts';

vi.mock(import('#app/features/live/overlay-chime'), () => ({ playChime: vi.fn() }));

function renderAlerts(first: number) {
  const { rerender, ...rendered } = renderLive(<OverlayAlerts subscriberCount={first} />);
  return {
    ...rendered,
    countBecomes: (count: number) => rerender(<OverlayAlerts subscriberCount={count} />),
  };
}

describe('apps/client/studio: OverlayAlerts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing for the count it first sees', () => {
    renderAlerts(25);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('announces a new subscriber with the count, and chimes once', () => {
    const { countBecomes } = renderAlerts(25);

    act(() => countBecomes(26));

    expect(screen.getByRole('status')).toHaveTextContent('New subscriber!26 subscribers');
    expect(playChime).toHaveBeenCalledOnce();
  });

  it('takes the banner away after six seconds', () => {
    const { countBecomes } = renderAlerts(25);
    act(() => countBecomes(26));

    act(() => {
      vi.advanceTimersByTime(SUBSCRIBER_ALERT_MS);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});
