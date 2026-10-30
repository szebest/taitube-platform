import { screen } from '@testing-library/react';

import { renderShell } from './render-shell';

describe('apps/client/web: shell search', () => {
  it('opens the command palette from the field-shaped search in the header', async () => {
    const { user } = await renderShell('/', false);
    const search = screen.getByRole('button', { name: 'Search' });

    expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    expect(search).toHaveAttribute('aria-keyshortcuts', '/ Control+K Meta+K');

    await user.click(search);

    expect(screen.getByRole('dialog', { name: 'Search Taitube' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });
});
