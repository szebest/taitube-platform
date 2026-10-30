import { screen } from '@testing-library/react';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAppearance = () => renderRoute(getRouter, '/settings/appearance');

describe('apps/client/web: the appearance settings', () => {
  it('lists theme, mode, accent and density, and ends on the way to the advanced page', async () => {
    await renderAppearance();

    const rows = await screen.findAllByRole('group');

    expect(rows.map(({ id }) => id).filter(Boolean)).toEqual([
      'theme',
      'mode',
      'accent',
      'density',
    ]);
    expect(screen.getByRole('link', { name: 'Fine-tune the look' })).toHaveAttribute(
      'href',
      '/settings/appearance/advanced'
    );
  });

  it('has no accessibility violations', async () => {
    await renderAppearance();
    await screen.findByRole('radio', { name: 'Sand' });

    expect(await axeViolations()).toEqual([]);
  });
});
