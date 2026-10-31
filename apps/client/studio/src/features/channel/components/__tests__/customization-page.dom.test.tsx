import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { renderCustomization } from '#app/features/channel/__tests__/render-customization';

describe('apps/client/studio: customization page', () => {
  it('lists every section as a form of its own under the page heading', async () => {
    await renderCustomization();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Channel customization' })
    ).toBeInTheDocument();
    for (const name of ['Name and handle', 'About', 'Picture and banner', 'Start here']) {
      expect(await screen.findByRole('form', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('form')).toHaveLength(4);
  });

  it('passes axe', async () => {
    await renderCustomization();

    expect(await axeViolations()).toEqual([]);
  });
});
