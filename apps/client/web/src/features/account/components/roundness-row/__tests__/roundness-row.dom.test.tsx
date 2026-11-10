import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';
import { getRouter } from '#app/router';

const shownRadius = () => document.documentElement.dataset.radius;

describe('apps/client/web: the roundness row', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('writes the radius token set from the appearance page, and shows the one in use', async () => {
    const { user } = await renderRoute(getRouter, '/settings/appearance');
    const row = await screen.findByRole('radiogroup', { name: 'Roundness' });
    expect(shownRadius()).toBe('round');

    await user.click(screen.getByRole('radio', { name: 'Sharp' }));

    expect(shownRadius()).toBe('sharp');
    expect(row).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sharp' })).toBeChecked();
  });
});
