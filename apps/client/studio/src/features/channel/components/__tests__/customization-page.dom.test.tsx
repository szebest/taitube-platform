import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { renderCustomization } from '../../__tests__/render-customization';

describe('apps/client/studio: customization page', () => {
  it('lists every section as a form of its own under the page heading', async () => {
    await renderCustomization();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Channel customization' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('form').map((form) => form.getAttribute('aria-labelledby'))
    ).toHaveLength(3);
    for (const name of ['Name and handle', 'About', 'Picture and banner']) {
      expect(screen.getByRole('form', { name })).toBeInTheDocument();
    }
  });

  it('passes axe', async () => {
    await renderCustomization();

    expect(await axeViolations()).toEqual([]);
  });
});
