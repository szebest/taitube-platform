import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const renderAt = (url: string) => renderRoute(getRouter, url, { handlers: [signInBrowser()] });

describe('apps/client/studio: useAccessDeniedToast', () => {
  it('shows the denial once and takes the param off the URL', async () => {
    const { router } = await renderAt('/upload?denied=admin');

    expect(await screen.findAllByText('Access denied')).toHaveLength(1);
    expect(router.state.location.search).not.toHaveProperty('denied');
  });

  it('shows nothing without the param', async () => {
    await renderAt('/upload');

    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });
});
