import { screen } from '@testing-library/react';

import { adminPick, renderCuration } from '#app/features/admin/components/__tests__/picks.fixture';

describe('apps/client/studio: /admin/curation', () => {
  it('has the picks loaded before the page first renders', async () => {
    await renderCuration([adminPick()]);

    expect(screen.getAllByRole('button', { name: /^Mountain lakes, / }).length).toBeGreaterThan(0);
  });
});
