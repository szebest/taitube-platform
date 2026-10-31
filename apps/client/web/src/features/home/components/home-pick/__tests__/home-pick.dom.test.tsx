import { screen, within } from '@testing-library/react';
import { type CurrentPickView, getCurrentPick } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  type EndpointResolver,
  fallbackPick,
  mockEndpoint,
  problemReply,
  scheduledPick,
  videoSummary,
} from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const NOW = Date.parse('2026-10-30T10:00:00.000Z');
const WINDOW = {
  startsAt: new Date(NOW - 10 * 3_600_000).toISOString(),
  endsAt: new Date(NOW + 14 * 3_600_000 + 5 * 60_000).toISOString(),
};
const VIDEO = videoSummary({ title: 'Lisbon at night' });

const NOTE_SLOT = '[data-slot="pick-of-the-day-note"]';

const answer = (pick: CurrentPickView): EndpointResolver<typeof getCurrentPick> => () =>
  HttpResponse.json(pick);

const NOTHING: EndpointResolver<typeof getCurrentPick> = () =>
  problemReply(ErrorCodes.VIDEO_NOT_FOUND);

const renderHome = (reply: EndpointResolver<typeof getCurrentPick>) =>
  renderRoute(getRouter, '/', { handlers: [mockEndpoint(getCurrentPick, reply), ...loaderApi()] });

describe('apps/client/web: HomePick', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a scheduled pick with its note and the time left', async () => {
    await renderHome(
      answer(scheduledPick(WINDOW, { video: VIDEO, note: 'Eighteen minutes of trams.' }))
    );

    const pick = await screen.findByRole('region', { name: 'Pick of the day' });

    expect(within(pick).getByRole('link', { name: 'Lisbon at night' })).toBeInTheDocument();
    expect(within(pick).getByText('Eighteen minutes of trams.')).toBeInTheDocument();
    expect(within(pick).getByRole('timer')).toHaveTextContent('Picked today, 14 hr left');
  });

  it('shows a fallback with neither a note nor a window', async () => {
    await renderHome(answer(fallbackPick({ video: VIDEO })));

    const pick = await screen.findByRole('region', { name: 'Pick of the day' });

    expect(within(pick).getByRole('link', { name: 'Lisbon at night' })).toBeInTheDocument();
    expect(within(pick).queryByRole('timer')).not.toBeInTheDocument();
    expect(pick.querySelector(NOTE_SLOT)).toBeNull();
  });

  it('shows no note for a scheduled pick that has none', async () => {
    await renderHome(answer(scheduledPick(WINDOW, { video: VIDEO, note: null })));

    const pick = await screen.findByRole('region', { name: 'Pick of the day' });

    expect(pick.querySelector(NOTE_SLOT)).toBeNull();
    expect(within(pick).getByRole('timer')).toBeInTheDocument();
  });

  it('shows no spotlight when nothing is scheduled and nothing is trending', async () => {
    await renderHome(NOTHING);

    expect(await screen.findByRole('heading', { name: 'Trending now' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Pick of the day' })).not.toBeInTheDocument();
  });
});
