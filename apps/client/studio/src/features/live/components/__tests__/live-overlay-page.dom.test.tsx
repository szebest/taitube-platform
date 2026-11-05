import { screen } from '@testing-library/react';
import { apiServer, chatLine, mockLiveChatSocket } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';
import { chatTicket, OVERLAY_TOKEN, overlayApi } from '../../__tests__/live-api.fixture';

async function renderOverlay(search: string, subscribers = 12) {
  apiServer.use(mockLiveChatSocket([chatLine(1, 'Hello there')]).handler);
  return renderRoute(getRouter, `/live/overlay/${OVERLAY_TOKEN}${search}`, {
    handlers: [overlayApi({ count: subscribers }), chatTicket],
  });
}

describe('apps/client/studio: LiveOverlayPage', () => {
  it.each([
    {
      search: '?widget=goal',
      shown: () => screen.getByRole('progressbar', { name: 'Subscriber goal' }),
    },
    { search: '?widget=chat', shown: () => screen.getByRole('log', { name: 'Live chat' }) },
    { search: '?widget=nonsense', shown: () => screen.getByRole('log', { name: 'Live chat' }) },
    { search: '', shown: () => screen.getByRole('log', { name: 'Live chat' }) },
  ])('draws the right widget for "$search"', async ({ search, shown }) => {
    await renderOverlay(search);

    expect(shown()).toBeInTheDocument();
  });

  it('draws nothing for the alerts widget until a subscriber arrives', async () => {
    await renderOverlay('?widget=alerts');

    expect(screen.getByRole('main')).toBeEmptyDOMElement();
  });

  it('works before the broadcast starts, on the token alone, with no studio around it', async () => {
    await renderOverlay('?widget=goal');

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull();
  });

  it('keeps its own dark colours on a ground the page leaves transparent', async () => {
    await renderOverlay('?widget=goal');

    expect(screen.getByRole('main')).toHaveAttribute('data-mode', 'dark');
    expect(screen.getByRole('main')).toHaveAttribute('data-obs-overlay');
  });

  it('passes axe', async () => {
    await renderOverlay('?widget=goal');

    expect(await axeViolations()).toEqual([]);
  });
});
