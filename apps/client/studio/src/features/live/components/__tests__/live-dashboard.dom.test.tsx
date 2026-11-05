import { screen, within } from '@testing-library/react';
import { openMyLiveStream } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  apiServer,
  mockEndpoint,
  mockLiveChatSocket,
  problemReply,
  stubEventSource,
} from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import {
  chatTicket,
  LIVE_VIDEO_ID,
  liveApi,
  liveNow,
  liveStream,
} from '../../__tests__/live-api.fixture';

type Stream = ReturnType<typeof liveStream>;

async function renderDashboard(stream: Stream = liveStream()) {
  const api = liveApi(stream);
  const events = stubEventSource();
  apiServer.use(mockLiveChatSocket([], { canModerate: true }).handler);
  const rendered = await renderRoute(getRouter, '/live', {
    handlers: [signInBrowser(), chatTicket, ...api.handlers],
  });
  await screen.findByRole('heading', { level: 1 });
  return { ...rendered, ...api, events };
}

describe('apps/client/studio: LiveDashboard', () => {
  it('shows an idle stream by its title, not live, with where to connect and what to do', async () => {
    await renderDashboard();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Friday build night' })
    ).toBeInTheDocument();
    expect(screen.getByText('Not live')).toBeInTheDocument();
    expect(screen.getByText(/Start streaming from OBS/)).toBeInTheDocument();
    expect(screen.getByLabelText('Stream key')).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('button', { name: 'Stop broadcast' })).toBeNull();
  });

  it('names a stream without a title', async () => {
    await renderDashboard(liveStream({ title: '' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Untitled stream' })).toBeInTheDocument();
  });

  it('marks a live stream with the live badge, and offers to stop it', async () => {
    await renderDashboard(liveNow());

    expect(screen.getByText('Live', { selector: '[data-slot="badge"]' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop broadcast' })).toBeInTheDocument();
  });

  it('shows the viewers the video event stream reports, and charts them', async () => {
    const { events } = await renderDashboard(liveNow());

    events.emit('live.viewers', { liveStreamId: liveNow().id, viewers: 42 });
    events.emit('live.viewers', { liveStreamId: liveNow().id, viewers: 45 });

    const viewers = screen.getByText('Viewers now').closest('figure') as HTMLElement;
    await within(viewers).findByText('45');
    expect(screen.getByRole('table', { hidden: true })).toHaveTextContent('42');
  });

  it('ends the page in the ended state once the creator stops the broadcast', async () => {
    const { user, stops } = await renderDashboard(liveNow());

    await user.click(screen.getByRole('button', { name: 'Stop broadcast' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Stop broadcast' })
    );

    expect(await screen.findByText('Ended')).toBeInTheDocument();
    expect(stops).toHaveLength(1);
  });

  it('links an ended broadcast to its recording on the viewer app, with no credentials', async () => {
    await renderDashboard(liveStream({ status: 'ENDED', ingest: null, videoId: LIVE_VIDEO_ID }));

    expect(screen.getByRole('link', { name: 'Watch the recording' })).toHaveAttribute(
      'href',
      `http://localhost:5173/watch/${LIVE_VIDEO_ID}`
    );
    expect(screen.queryByLabelText('Stream key')).toBeNull();
  });

  it('says the stream did not load, and tries again from its retry', async () => {
    let answers = 0;
    apiServer.use(mockLiveChatSocket([], { canModerate: true }).handler);
    const { user } = await renderRoute(getRouter, '/live', {
      handlers: [
        signInBrowser(),
        mockEndpoint(openMyLiveStream, () =>
          answers++ < 2 ? problemReply(ErrorCodes.INTERNAL) : HttpResponse.json(liveStream())
        ),
        chatTicket,
      ],
    });

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    await renderDashboard();

    expect(await axeViolations()).toEqual([]);
  });
});
