import { screen } from '@testing-library/react';

import { renderRoute } from '#app/__tests__/render-route';

describe('apps/web: root route in the browser', () => {
  afterEach(() => {
    document.cookie = 'vp.theme=; Max-Age=0; Path=/';
  });

  it('re-themes the document from the header switch and keeps the choice for the next visit', async () => {
    const { user } = await renderRoute('/watch/not-a-video');
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('checkbox', { name: 'theme switch' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toBe('vp.theme=light');
  });
});
