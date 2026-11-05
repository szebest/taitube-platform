import { renderLive } from '../../__tests__/render-live';
import { LiveDashboardSkeleton } from '../live-dashboard-skeleton';

describe('apps/client/studio: LiveDashboardSkeleton', () => {
  it('keeps the loaded layout in grey: three figures, hidden from assistive technology', () => {
    const { container } = renderLive(<LiveDashboardSkeleton />);

    expect(container.querySelectorAll('[data-slot="stat-card-skeleton"]')).toHaveLength(3);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
