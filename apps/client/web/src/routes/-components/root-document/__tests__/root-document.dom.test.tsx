import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { getRouter } from '#app/router';

describe('apps/client/web: root document in the browser', () => {
  it('switches theme and mode from the header menu with no reload, and keeps them for the next visit', async () => {
    const { user } = await renderRoute(getRouter, '/watch/not-a-video');
    expect(document.documentElement.dataset).toMatchObject({ theme: 'sand', mode: 'dark' });

    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Nocturne' }));
    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));

    expect(document.documentElement.dataset).toMatchObject({
      theme: 'nocturne',
      mode: 'light',
      radius: 'sharp',
    });
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"nocturne","mode":"light"');
  });
});
