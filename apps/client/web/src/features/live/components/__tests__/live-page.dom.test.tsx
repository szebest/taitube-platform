import { screen } from '@testing-library/react';
import { type LiveStreamPublicView, listLiveStreams } from '@vp/api-contracts';
import { LIVE_STREAM_ID, liveStream, mockEndpoint } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const renderLivePage = (items: LiveStreamPublicView[]) =>
  renderRoute(getRouter, '/live', {
    handlers: [mockEndpoint(listLiveStreams, () => HttpResponse.json({ items })), ...loaderApi()],
  });

describe('apps/client/web: LivePage', () => {
  it('lists every broadcast live now, each linked to its live page', async () => {
    await renderLivePage([liveStream()]);

    expect(screen.getByRole('heading', { level: 1, name: 'Live now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lisbon trams at dusk' })).toHaveAttribute(
      'href',
      `/live/${LIVE_STREAM_ID}`
    );
    expect(screen.getByText('41 watching')).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it('shows its empty state as the page heading, with the way back to the home feed', async () => {
    await renderLivePage([]);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Nothing is live right now' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/');
    expect(await axeViolations()).toEqual([]);
  });
});
