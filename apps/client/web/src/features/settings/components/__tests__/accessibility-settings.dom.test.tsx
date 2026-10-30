import { screen } from '@testing-library/react';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAccessibility = () => renderRoute(getRouter, '/settings/accessibility');

describe('apps/client/web: the accessibility settings', () => {
  it('lists font size, contrast, motion, borders and the captions defaults, in that order', async () => {
    await renderAccessibility();

    const rows = await screen.findAllByRole('group');

    expect(rows.map(({ id }) => id).filter(Boolean)).toEqual([
      'font-size',
      'contrast',
      'reduced-motion',
      'bold-borders',
      'captions',
      'captions-language',
    ]);
  });

  it('has no accessibility violations', async () => {
    await renderAccessibility();
    await screen.findByRole('group', { name: 'Font size' });

    expect(await axeViolations()).toEqual([]);
  });
});
