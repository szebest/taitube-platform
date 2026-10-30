import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAppearance = () => renderRoute(getRouter, '/settings/appearance');

const shown = () => {
  const { spacing, sizing } = document.documentElement.dataset;
  return `${spacing} ${sizing}`;
};

describe('apps/client/web: the density row', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('writes spacing and sizing together, and returns both to the theme on comfortable', async () => {
    const { user } = await renderAppearance();
    expect(await screen.findByRole('radio', { name: 'Comfortable' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(shown()).toBe('compact small');
    expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Comfortable' }));
    expect(shown()).toBe('default medium');
  });
});
