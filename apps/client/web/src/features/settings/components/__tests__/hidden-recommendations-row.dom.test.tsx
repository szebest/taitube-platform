import { screen, within } from '@testing-library/react';
import { listRecommendationFeedback, removeRecommendationFeedback } from '@vp/api-contracts';
import { channel, mockEndpoint, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const AT = '2026-03-01T12:00:00.000Z';
const ROWS = [
  {
    id: '0190c3a0-5e1d-7000-8000-00000000f001',
    kind: 'hide_channel' as const,
    channelId: '0190c3a0-5e1d-7000-8000-00000000d001',
    createdAt: AT,
    channel: channel({ displayName: 'Lisbon Films' }),
  },
  {
    id: '0190c3a0-5e1d-7000-8000-00000000f002',
    kind: 'not_interested' as const,
    videoId: '0190c3a0-5e1d-7000-8000-00000000c001',
    createdAt: AT,
    video: videoSummary({ title: 'Lisbon at night' }),
    channel: null,
  },
  {
    id: '0190c3a0-5e1d-7000-8000-00000000f003',
    kind: 'not_interested' as const,
    videoId: '0190c3a0-5e1d-7000-8000-00000000c002',
    createdAt: AT,
    video: null,
    channel: null,
  },
];

function renderPrivacy(rows: typeof ROWS | [] = ROWS) {
  const removed: string[] = [];
  const rendered = renderRoute(getRouter, '/settings/privacy', {
    handlers: [
      signInBrowser(),
      mockEndpoint(listRecommendationFeedback, () =>
        HttpResponse.json({ items: rows, nextCursor: null })
      ),
      mockEndpoint(removeRecommendationFeedback, ({ params }) => {
        removed.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    ],
  });
  return { rendered, removed };
}

describe('apps/client/web: the hidden recommendations row', () => {
  it('lists each hidden channel and video, and a video no longer available', async () => {
    const { rendered } = renderPrivacy();
    await rendered;

    const row = await screen.findByRole('group', { name: 'Hidden channels and videos' });

    expect(await within(row).findByText('Channel: Lisbon Films')).toBeInTheDocument();
    expect(within(row).getByText('Lisbon at night')).toBeInTheDocument();
    expect(within(row).getByText('A video that is no longer available')).toBeInTheDocument();
  });

  it('undoes one row, and says what it undoes', async () => {
    const { rendered, removed } = renderPrivacy();
    const { user } = await rendered;

    await user.click(await screen.findByRole('button', { name: 'Undo hiding Lisbon at night' }));

    expect(removed).toEqual([ROWS[1]?.id]);
  });

  it('says so when nothing is hidden', async () => {
    const { rendered } = renderPrivacy([]);
    await rendered;

    expect(
      await screen.findByText(
        'Nothing is hidden. Choose Not interested on a recommended video to hide it.'
      )
    ).toBeInTheDocument();
  });
});
