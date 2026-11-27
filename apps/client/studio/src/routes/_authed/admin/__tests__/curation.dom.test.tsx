import { screen } from '@testing-library/react';
import { AdminPageSkeleton } from '#app/features/admin';
import { adminPick, renderCuration } from '#app/features/admin/__tests__/picks.fixture';
import { Route } from '../curation';

describe('apps/client/studio: /admin/curation', () => {
  it('shows its skeleton while the loader runs', () => {
    expect(Route.options.pendingComponent).toBe(AdminPageSkeleton);
  });

  it('has the picks loaded before the page first renders', async () => {
    await renderCuration([adminPick()]);

    expect(screen.getAllByRole('button', { name: /^Mountain lakes, / }).length).toBeGreaterThan(0);
  });
});
